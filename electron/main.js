const { app, BrowserWindow, Menu, dialog, session } = require("electron");
const path = require("path");
const { spawn, execFile } = require("child_process");

const SERVER_EXE = "signai-server.exe";

let serverProc = null;
let mainWindow = null;
let cerrando = false;        // true durante el apagado: no avisar de la muerte del servidor
let errorMostrado = false;   // el aviso de "motor caido" se muestra una sola vez

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
function limpiarServidorHuerfano(done) {
  if (!app.isPackaged || process.platform !== "win32") return done();
  execFile("taskkill", ["/IM", SERVER_EXE, "/F"], { windowsHide: true }, () => done());
}

// Lanza el servidor local de inferencia (Python).
//  - En desarrollo: ejecuta "SignAI Server.py" con el lanzador `py`.
//  - Empaquetado: ejecuta el .exe generado con PyInstaller en resources/.
function startInferenceServer() {
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
      avisarMotorCaido(
        "No se encontro el motor de traduccion.\n\n" +
        "Reinstala SignAI para restaurar los archivos que faltan."
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
          "Suele deberse a que el puerto 8765 esta ocupado por otro programa, " +
          "o a que el antivirus bloqueo signai-server.exe.\n\n" +
          "Cierra SignAI por completo y vuelve a abrirlo. El resto de la app " +
          "(juegos y lecciones) sigue funcionando."
        );
      }
    });
  } catch (err) {
    console.error("[server] error al lanzar:", err);
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
    try {
      spawn("taskkill", ["/pid", String(proc.pid), "/T", "/F"], {
        windowsHide: true,
      });
      return;
    } catch (err) {
      console.error("[server] taskkill fallo, se intenta kill():", err);
    }
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

  limpiarServidorHuerfano(() => startInferenceServer());
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
