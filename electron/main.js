const { app, BrowserWindow, Menu, dialog, session } = require("electron");
const path = require("path");
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
      serverProc = spawn(exe, [], { windowsHide: true });
    } else {
      const script = path.join(__dirname, "../Avances/Modelo Transformer/SignAI Server.py");
      serverProc = spawn("py", [script], {
        cwd: path.join(__dirname, "../Avances/Modelo Transformer"),
        windowsHide: true,
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

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    // Por debajo de esto la interfaz se rompe; en equipos con pantallas
    // pequenias la ventana por defecto no siempre cabe.
    minWidth: 1024,
    minHeight: 640,
    show: false, // se muestra ya pintada: sin destello blanco al abrir
    icon: getWindowsIconPath(),
  });
  mainWindow = win;

  win.once("ready-to-show", () => win.show());
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });

  if (!app.isPackaged) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
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
