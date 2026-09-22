const { app, BrowserWindow, Menu, dialog, screen, session, shell } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const crypto = require("crypto");
const { spawn, execFile } = require("child_process");

const SERVER_EXE = "signai-server.exe";
const PUERTO_SERVIDOR = Number(process.env.SIGNAI_PORT || 8765);
const URL_SALUD = `http://127.0.0.1:${PUERTO_SERVIDOR}/health`;

// Cuanto esperamos a que el motor conteste /health. El primer arranque en frio
// carga torch y MediaPipe desde disco y puede tardar bastante mas que los
// siguientes, asi que el margen es generoso.
const SALUD_INTENTOS = 60;
const SALUD_ESPERA_MS = 500;

let serverProc = null;
let mainWindow = null;
let cerrando = false;        // true durante el apagado: no avisar de la muerte del servidor
let errorMostrado = false;   // el aviso de "motor caido" se muestra una sola vez
let reintentoHecho = false;  // solo se reintenta arrancar el motor una vez

// El motor enciende la camara en cuanto algo se conecta a /ws o /video, asi
// que hay que poder distinguir "esta app" de "una pagina cualquiera abierta en
// el navegador del usuario". Este token se le pasa al servidor por entorno y
// se inyecta como cabecera en las peticiones de NUESTRA sesion de Electron:
// el codigo del frontend no lo conoce y no hace falta tocarlo, y una web de
// fuera no puede fabricarlo.
let tokenServidor = crypto.randomBytes(32).toString("base64url");
const RUTA_TOKEN = path.join(os.tmpdir(), `signai-${PUERTO_SERVIDOR}.token`);

// Dos ventanas de SignAI pelearian por el puerto 8765 y por la camara: la
// segunda se queda sin servidor y la app parece rota. La instancia extra cede
// el paso y enfoca la ventana que ya estaba abierta.
const esInstanciaPrimaria = app.requestSingleInstanceLock();
if (!esInstanciaPrimaria) app.quit();

function getWindowsIconPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "icon.ico");
  }
  return path.join(__dirname, "../build/SignAI.ico");
}

// Si la app anterior se cerro de golpe (crash, cierre de sesion), su
// signai-server.exe puede seguir vivo ocupando el puerto 8765; el servidor
// nuevo no podria hacer bind y moriria en silencio. Como el lock de instancia
// unica ya garantiza que no hay otro SignAI legitimo corriendo, cualquier
// signai-server.exe que quede es huerfano y se puede matar.
//
// En desarrollo NO se hace: ahi el motor corre como python.exe y matarlos
// todos se llevaria por delante procesos ajenos al proyecto. Para ese caso
// sirve el sondeo de sondearSalud(), que detecta el huerfano y lo reutiliza.
function limpiarServidorHuerfano(done) {
  if (!app.isPackaged || process.platform !== "win32") return done();
  execFile("taskkill", ["/IM", SERVER_EXE, "/F"], { windowsHide: true }, () => done());
}

// Un unico sondeo a /health. Devuelve el estado del motor, o null si todavia
// no escucha. El servidor responde 503 cuando arranco pero su hilo murio o
// perdio la camara, asi que un cuerpo con ok:false tambien es informacion.
async function sondearSalud(timeoutMs = 1500) {
  try {
    const r = await fetch(URL_SALUD, { signal: AbortSignal.timeout(timeoutMs) });
    const estado = await r.json().catch(() => null);
    return estado ?? { ok: r.ok };
  } catch {
    return null;
  }
}

async function esperarServidorSano() {
  for (let i = 0; i < SALUD_INTENTOS; i++) {
    if (cerrando) return null;
    const estado = await sondearSalud();
    if (estado) return estado;
    await new Promise((r) => setTimeout(r, SALUD_ESPERA_MS));
  }
  return null;
}

// Lanza el servidor local de inferencia (Python).
//  - En desarrollo: ejecuta "SignAI Server.py" con el lanzador `py`.
//  - Empaquetado: ejecuta el .exe generado con PyInstaller en resources/.
function startInferenceServer() {
  cerrando = false;
  try {
    if (app.isPackaged) {
      const exe = path.join(process.resourcesPath, "signai-server", SERVER_EXE);
      serverProc = spawn(exe, [], {
        windowsHide: true,
        env: { ...process.env, SIGNAI_TOKEN: tokenServidor },
      });
    } else {
      const script = path.join(__dirname, "../Avances/Modelo Transformer/SignAI Server.py");
      serverProc = spawn("py", [script], {
        cwd: path.join(__dirname, "../Avances/Modelo Transformer"),
        windowsHide: true,
        env: { ...process.env, SIGNAI_TOKEN: tokenServidor },
      });
    }

    serverProc.stdout?.on("data", (d) => console.log(`[server] ${d}`.trim()));
    serverProc.stderr?.on("data", (d) => console.log(`[server] ${d}`.trim()));
    serverProc.on("error", (err) => {
      console.error("[server] no se pudo iniciar:", err);
      // El motivo es distinto segun el modo, y decirle "reinstala SignAI" a
      // quien esta desarrollando (donde lo que falta es el lanzador `py`) no
      // ayuda en nada.
      avisarMotorCaido(
        app.isPackaged
          ? "No se encontro el motor de traduccion.\n\n" +
            "Reinstala SignAI para restaurar los archivos que faltan."
          : "No se pudo ejecutar el lanzador `py`.\n\n" +
            "Instala Python 3 desde python.org marcando la casilla de anadirlo " +
            "al PATH, o arranca el servidor a mano con `npm run server`."
      );
    });
    serverProc.on("exit", (code) => {
      console.log(`[server] termino (code=${code})`);
      serverProc = null;
      // Sin ventana visible el usuario no ve el error del proceso: si el
      // servidor muere solo (puerto ocupado, antivirus, falta de camara) hay
      // que decirselo, o solo vera el spinner "conectando" para siempre.
      if (!cerrando && code !== 0) {
        avisarMotorCaido(
          "El motor de traduccion se cerro inesperadamente.\n\n" +
          `Suele deberse a que el puerto ${PUERTO_SERVIDOR} esta ocupado por otro ` +
          "programa, o a que el antivirus bloqueo signai-server.exe.\n\n" +
          "Cierra SignAI por completo y vuelve a abrirlo. El resto de la app " +
          "(juegos y lecciones) sigue funcionando."
        );
      }
    });
  } catch (err) {
    console.error("[server] error al lanzar:", err);
  }
}

// Arranca el motor y NO lo da por bueno hasta que /health contesta. Antes nadie
// llamaba a /health: si el servidor arrancaba pero se colgaba (import lento de
// torch, hilo del engine muerto), la app no decia absolutamente nada y el
// usuario se quedaba mirando el spinner de "conectando" indefinidamente.
async function prepararServidor() {
  const yaVivo = await sondearSalud(800);
  if (yaVivo) {
    // Un motor de una sesion anterior (tipico en desarrollo). Su token es otro,
    // asi que hay que adoptarlo o nuestras peticiones tendrian un 403.
    try {
      const suyo = fs.readFileSync(RUTA_TOKEN, "utf8").trim();
      if (suyo) tokenServidor = suyo;
    } catch {
      // Sin fichero de token: el servidor se arranco a mano y no exige token.
    }
    console.log("[server] ya hay un motor escuchando; se reutiliza.");
    return;
  }

  startInferenceServer();
  const estado = await esperarServidorSano();
  if (cerrando) return;

  if (estado && estado.ok) {
    console.log(`[server] listo (modelo '${estado.modelo}').`);
    return;
  }

  // El proceso murio y todavia no habiamos reintentado: una segunda
  // oportunidad cubre el caso comun de un huerfano que solto el puerto tarde.
  if (!serverProc && !reintentoHecho) {
    reintentoHecho = true;
    console.log("[server] no respondio; se reintenta una vez.");
    return prepararServidor();
  }

  if (estado && !estado.ok) {
    console.error("[server] arranco pero no esta sano:", estado.fallo || estado);
    avisarMotorCaido(
      "El motor de traduccion arranco pero no puede reconocer senias.\n\n" +
      (estado.camara === false
        ? "No esta recibiendo imagen de la camara. Comprueba que no la este " +
          "usando otra aplicacion y que SignAI tenga permiso en Privacidad."
        : "Se detuvo por un error interno.") +
      "\n\nCierra SignAI por completo y vuelve a abrirlo."
    );
    return;
  }

  if (serverProc) {
    console.error("[server] sigue vivo pero no responde a /health.");
    avisarMotorCaido(
      "El motor de traduccion no termino de arrancar.\n\n" +
      "Puede que el antivirus lo este analizando, o que el equipo vaya muy " +
      "justo de memoria.\n\nCierra SignAI por completo y vuelve a abrirlo."
    );
  }
}

function avisarMotorCaido(mensaje) {
  if (errorMostrado || cerrando) return;
  errorMostrado = true;
  dialog.showMessageBox(mainWindow ?? undefined, {
    type: "warning",
    title: "SignAI",
    message: "El motor de traduccion no esta disponible",
    detail: mensaje,
    buttons: ["Entendido"],
    noLink: true,
  }).catch(() => {});
}

// En Windows `kill()` solo termina el proceso directo. En desarrollo ese
// proceso es el lanzador `py`, que a su vez arranca un python.exe hijo: matar
// solo al padre deja el servidor vivo ocupando el puerto 8765, y el siguiente
// arranque de la app falla al abrir la camara. `taskkill /T` mata el arbol.
function stopInferenceServer() {
  cerrando = true;
  const proc = serverProc;
  serverProc = null;
  if (!proc || proc.exitCode !== null) return;

  if (process.platform === "win32" && proc.pid) {
    // execFile con callback, no spawn: un ChildProcess sin listener 'error'
    // LANZA si el binario no se puede ejecutar, y esto corre dentro de
    // before-quit. En un equipo sin taskkill en el PATH, cerrar la app
    // reventaba el proceso principal y ademas dejaba el servidor vivo.
    execFile("taskkill", ["/pid", String(proc.pid), "/T", "/F"],
      { windowsHide: true }, (err) => {
        if (!err) return;
        console.error("[server] taskkill fallo, se intenta kill():", err);
        try { proc.kill(); } catch {}
      });
    return;
  }

  try {
    proc.kill();
  } catch {}
}

function protocoloDe(url) {
  try {
    return new URL(url).protocol;
  } catch {
    return "";
  }
}

// Tamano de arranque. 1280x720 es lo deseable, pero pedirlo a secas en un
// portatil de 1366x768 dejaba la ventana practicamente pegada a los bordes, y
// en una pantalla mas pequenia (o con escalado de Windows al 150%, que reduce
// el area util) la barra de tareas se comia parte de la app. Se recorta al
// area de trabajo real del monitor donde esta el cursor, dejando un margen.
const MIN_ANCHO = 800;
const MIN_ALTO = 600;

function medidasDeVentana() {
  try {
    const punto = screen.getCursorScreenPoint();
    const { workArea } = screen.getDisplayNearestPoint(punto);
    const ancho = Math.max(MIN_ANCHO, Math.min(1280, workArea.width - 40));
    const alto = Math.max(MIN_ALTO, Math.min(720, workArea.height - 40));
    return {
      width: ancho,
      height: alto,
      x: Math.round(workArea.x + (workArea.width - ancho) / 2),
      y: Math.round(workArea.y + (workArea.height - alto) / 2),
    };
  } catch (err) {
    // `screen` solo esta disponible con la app lista; si algo falla, mejor
    // abrir con el tamanio de siempre que no abrir.
    console.error("[ventana] no se pudo leer el area de trabajo:", err);
    return { width: 1280, height: 720 };
  }
}

const createWindow = () => {
  // SIGNAI_USAR_DIST=1 carga la compilacion en vez del servidor de Vite. Es la
  // unica forma de probar lo que ve el usuario instalado (CSP incluida) sin
  // pasar por `npm run dist`, que ademas tiene que empaquetar todo Python.
  const usarDist = app.isPackaged || process.env.SIGNAI_USAR_DIST === "1";
  const win = new BrowserWindow({
    ...medidasDeVentana(),
    // La interfaz esta verificada hasta aqui (ver
    // pruebas/ui/verificar-tamanos.cjs). Estaba en 1024x640, que dejaba fuera
    // a quien trabaja con la ventana a media pantalla.
    minWidth: MIN_ANCHO,
    minHeight: MIN_ALTO,
    show: false, // se muestra ya pintada: sin destello blanco al abrir
    icon: getWindowsIconPath(),
  });
  mainWindow = win;

  // El renderer se puede morir solo: se queda sin memoria, el driver de la
  // GPU revienta con el modelo 3D, o Windows mata el proceso. Sin esto la
  // ventana se queda en blanco para siempre y no hay ni menu con que
  // recargar (al empaquetar se quita). Recargar es lo unico que hace falta:
  // el estado que importa vive en localStorage.
  win.webContents.on("render-process-gone", (_evento, detalles) => {
    console.error("[renderer] proceso caido:", detalles.reason);
    if (cerrando || win.isDestroyed()) return;
    if (detalles.reason === "clean-exit" || detalles.reason === "killed") return;
    win.reload();
  });

  win.on("unresponsive", async () => {
    if (cerrando || win.isDestroyed()) return;
    const { response } = await dialog.showMessageBox(win, {
      type: "warning",
      title: "SignAI",
      message: "SignAI dejo de responder",
      detail: "Puedes esperar a que reaccione o recargar la pantalla. Tu " +
        "progreso guardado no se pierde al recargar.",
      buttons: ["Esperar", "Recargar"],
      defaultId: 1,
      noLink: true,
    }).catch(() => ({ response: 0 }));
    if (response === 1 && !win.isDestroyed()) win.reload();
  });

  // Sin esto, un window.open o un <a target="_blank"> abria una BrowserWindow
  // nueva con los webPreferences por defecto, y un enlace normal sacaba a la
  // ventana principal fuera de la app. Como al empaquetar no hay menu
  // (Menu.setApplicationMenu(null)), tampoco habia Recargar ni Atras: el
  // usuario se quedaba atrapado en una web ajena dentro de SignAI.
  const esExterno = (url) => /^https?:$/.test(protocoloDe(url));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (esExterno(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (evento, url) => {
    if (url === win.webContents.getURL()) return;
    const permitido = usarDist
      ? url.startsWith("file://")
      : url.startsWith("http://localhost:5173");
    if (permitido) return;
    evento.preventDefault();
    if (esExterno(url)) shell.openExternal(url);
  });

  win.once("ready-to-show", () => win.show());
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });

  if (usarDist) {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  } else {
    win.loadURL("http://localhost:5173");
  }
};

app.whenReady().then(() => {
  if (!esInstanciaPrimaria) return;

  if (process.platform === "win32") {
    app.setAppUserModelId("com.signai.app");
  }

  // El menu por defecto de Electron (Reload, Toggle DevTools, Zoom...) es de
  // desarrollo y confunde a quien solo usa la app instalada.
  if (app.isPackaged) Menu.setApplicationMenu(null);

  // Sin handler explicito, que se conceda la camara depende del default de
  // cada version de Electron. Aqui se declara lo unico que la app necesita:
  // camara (juegos y lecciones usan getUserMedia) y copiar al portapapeles
  // (el correo de contacto en "Acerca de"). Todo lo demas se niega.
  // Windows sigue mandando: si el usuario bloqueo la camara en Privacidad,
  // no hay imagen por mucho que Electron la conceda.
  const PERMISOS_CONCEDIDOS = new Set(["media", "clipboard-sanitized-write"]);
  session.defaultSession.setPermissionRequestHandler((_wc, permiso, permitir) => {
    permitir(PERMISOS_CONCEDIDOS.has(permiso));
  });
  // La ruta SINCRONA (navigator.permissions.query, y parte de los caminos de
  // media) no pasa por el handler de arriba: sin esto se resolvia con el
  // default de Electron y la lista blanca no se aplicaba de verdad.
  session.defaultSession.setPermissionCheckHandler(
    (_wc, permiso) => PERMISOS_CONCEDIDOS.has(permiso)
  );

  // Sellar con el token TODO lo que salga de esta sesion hacia el motor. Cubre
  // el <img> del MJPEG y el handshake del WebSocket, que no pueden poner
  // cabeceras por su cuenta desde el frontend.
  // Dos trampas de los patrones de Chromium: NO admiten puerto en el host
  // (`*://127.0.0.1:8765/*` es invalido y lanza), y el comodin de esquema `*`
  // solo cubre http y https, no ws. Hay que nombrar ws explicitamente o el
  // handshake del WebSocket se queda sin token. El puerto se comprueba dentro.
  session.defaultSession.webRequest.onBeforeSendHeaders(
    {
      urls: [
        "http://127.0.0.1/*", "http://localhost/*",
        "ws://127.0.0.1/*", "ws://localhost/*",
      ],
    },
    (detalles, callback) => {
      let esElMotor = false;
      try {
        esElMotor = new URL(detalles.url).port === String(PUERTO_SERVIDOR);
      } catch {
        esElMotor = false;
      }
      if (!esElMotor) return callback({});
      callback({
        requestHeaders: {
          ...detalles.requestHeaders,
          "X-SignAI-Token": tokenServidor,
        },
      });
    }
  );

  limpiarServidorHuerfano(() => { prepararServidor(); });
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.on("window-all-closed", () => {
  stopInferenceServer();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", stopInferenceServer);

// Una excepcion sin atrapar en el proceso principal mata la app **y deja vivo
// al signai-server.exe**, que se queda con el puerto 8765 y con la camara: el
// siguiente arranque falla y el usuario no entiende por que. Aqui se registra,
// se apaga el motor y se cierra en orden.
process.on("uncaughtException", (err) => {
  console.error("[principal] excepcion sin atrapar:", err);
  try {
    stopInferenceServer();
  } catch {}
  dialog.showErrorBox(
    "SignAI",
    "SignAI tuvo un error interno y debe cerrarse.\n\n" +
      "Vuelve a abrirlo; si se repite, reinstala la aplicacion.\n\n" +
      String(err?.message || err)
  );
  app.exit(1);
});

process.on("unhandledRejection", (motivo) => {
  // No se cierra la app: una promesa rechazada suele ser un sondeo de red o
  // un dialogo cancelado, no un estado corrupto. Pero sin registrarlo no hay
  // manera de diagnosticar nada desde la consola.
  console.error("[principal] promesa rechazada sin atrapar:", motivo);
});
