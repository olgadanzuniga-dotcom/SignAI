// Lanza el Electron real contra dist/ (o sea, con la CSP de produccion activa)
// y comprueba dos cosas que solo se ven en la app montada entera:
//
//  1. que no hay violaciones de Content-Security-Policy;
//  2. que el frontend consigue hablar con el motor, cosa que solo puede pasar
//     si Electron le esta inyectando bien el token de autorizacion.
//
// Uso:  node pruebas/ui/verificar-csp-y-token.cjs
// Antes hay que haber hecho `npm run build`.
const { _electron: electron } = require("playwright-core");
const path = require("path");

// Raiz del repo, para que el script funcione desde cualquier sitio.
const RAIZ = path.resolve(__dirname, "..", "..");

const RUTAS = ["/", "/Aprender", "/Juegos", "/Ajustes", "/Camara"];

(async () => {
  const app = await electron.launch({
    args: ["."],
    cwd: RAIZ,
    env: { ...process.env, SIGNAI_USAR_DIST: "1" },
  });

  // La salida del proceso principal (arranque del motor, avisos de Electron) no
  // aparece en la consola del renderer; sin esto, un fallo al arrancar se veia
  // solo como "no conecta" y no habia por donde cogerlo.
  const principal = [];
  app.process().stdout?.on("data", (d) => principal.push(String(d).trimEnd()));
  app.process().stderr?.on("data", (d) => principal.push(String(d).trimEnd()));

  const win = await app.firstWindow();
  const mensajes = [];
  win.on("console", (m) => mensajes.push(m.type() + ": " + m.text()));
  win.on("pageerror", (e) => mensajes.push("pageerror: " + e.message));

  await win.waitForLoadState("domcontentloaded");
  await win.waitForFunction(() => !!document.querySelector("#root > *"), null, {
    timeout: 60000,
  });

  // Saltarse los tutoriales: si no, el overlay tapa la pantalla y no se llega
  // a montar lo que queremos mirar.
  await win.evaluate(() => {
    [
      "tourSignAICompleted", "tourSignAI_camara", "tourSignAI_aprender",
      "tourSignAI_leccion_intro", "tourSignAI_leccion_camara",
      "tourSignAI_juegos", "tourSignAI_ajustes",
    ].forEach((k) => localStorage.setItem(k, "true"));
  });

  for (const ruta of RUTAS) {
    await win.evaluate((r) => { window.location.hash = "#" + r; }, ruta);
    await win.waitForTimeout(2500);
  }

  // El traductor tiene que acabar mostrando el MJPEG: eso prueba de una vez el
  // WebSocket y el stream, los dos con token.
  await win.waitForTimeout(5000);
  const conectado = await win.evaluate(
    () => !!document.querySelector('img[src*="/video"]')
  );

  const csp = mensajes.filter((m) => /Content Security Policy|Refused to/i.test(m));
  const otros = mensajes.filter(
    (m) => /^(error|pageerror)/.test(m) && !csp.includes(m)
  );

  console.log("");
  console.log("Mensajes de consola: " + mensajes.length);
  console.log("Violaciones de CSP:  " + csp.length);
  csp.slice(0, 12).forEach((m) => console.log("  - " + m.slice(0, 200)));
  console.log("Otros errores:       " + otros.length);
  otros.slice(0, 10).forEach((m) => console.log("  ! " + m.slice(0, 200)));
  console.log("MJPEG en pantalla:   " + (conectado ? "SI (token OK)" : "NO"));

  const ok = csp.length === 0 && conectado;
  if (!ok) {
    console.log("");
    console.log("--- ultimas lineas del proceso principal ---");
    principal.slice(-25).forEach((l) => console.log("  " + l));
  }
  console.log("");
  console.log("RESULTADO: " + (ok ? "OK" : "REVISAR"));

  await app.close();
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error("fallo:", e.message);
  process.exit(2);
});
