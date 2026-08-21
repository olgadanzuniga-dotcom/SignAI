// Verificacion del rediseno contra el Electron real.
//
// Dos cosas que no se ven bien en una captura y si en los estilos calculados:
//  1. cajas cuyo fondo va a contracorriente del tema (asi se ve un par
//     claro/oscuro que se quedo sin migrar);
//  2. pantallas que se salen del alto de la ventana.
const { _electron: electron } = require("playwright-core");
const path = require("path");

// Raiz del repo, para que el script funcione desde cualquier sitio.
const RAIZ = path.resolve(__dirname, "..", "..");

const RUTAS = [
  ["/", "portada"], ["/Camara", "traductor"], ["/Aprender", "aprender"],
  ["/Aprender/abecedario", "leccion"], ["/Aprendizaje", "aprendizaje"],
  ["/Juegos", "juegos"], ["/Quiz", "quiz"], ["/Memorama", "memorama"],
  ["/Deletreo", "deletreo"], ["/Desafio", "desafio"], ["/Ajustes", "ajustes"],
  ["/Acerca", "acerca"],
];
const TAMANOS = [[1024,640,"minimo"],[1280,720,"normal"],[1920,1000,"grande"]];

// Lo que si puede ir a contracorriente, y por que: `bg-white` esta reservado a
// las superficies que sostienen una ilustracion de linea sobre transparente
// (cartas del memorama, fichas del deletreo), y lo que va encima del video de
// la camara nunca ve el fondo de la app.
// "bg-black/" a secas y no una opacidad concreta: la regla de ADR-006 es
// "lo que se dibuja encima del video de la camara", y ahi la opacidad varia
// segun el sitio (Camara.jsx le pasa bg-black/70 al ServerStatusOverlay,
// cuyo valor por defecto es bg-black/60). Fijar el numero convertia un
// retoque de estilo en un falso positivo.
const EXCEPCIONES = ["bg-white", "backface-hidden", "bg-black/", "bg-red-500/90", "fixed inset-0 bg-black"];
// Estas si tienen que poder desplazarse: son documentos largos, no pantallas.
const SE_DESPLAZAN = new Set(["ajustes", "acerca"]);

(async () => {
  const app = await electron.launch({
    args: ["."],
    cwd: RAIZ,
    // Contra la compilacion, no contra el servidor de Vite: asi se prueba lo
    // que ve el usuario instalado y el script no necesita `npm run dev` aparte.
    env: { ...process.env, SIGNAI_USAR_DIST: "1" },
  });
  const win = await app.firstWindow();
  await win.waitForLoadState("domcontentloaded");
  await win.waitForFunction(() => location.protocol !== "about:" && !!document.querySelector("#root > *"), null, { timeout: 60000 });
  await win.evaluate(() => {
    ["tourSignAICompleted","tourSignAI_aprender","tourSignAI_ajustes","tourSignAI_acerca",
     "tourSignAI_quiz","tourSignAI_memorama","tourSignAI_deletreo","tourSignAI_desafio",
     "tourSignAI_juegos","tourSignAI_aprendizaje","tourSignAI_leccion_intro",
     "tourSignAI_leccion_camara","tourSignAI_camara"].forEach(k => localStorage.setItem(k,"true"));
  });

  let sospechas = 0, desbordes = 0;

  for (const [w,h,tam] of TAMANOS) {
    await win.setViewportSize({ width: w, height: h });
    for (const tema of ["light","dark"]) {
      await win.evaluate(t => { localStorage.setItem("lsm_theme",t); document.documentElement.classList.toggle("dark", t==="dark"); }, tema);
      console.log(`\n===== ${tam} ${w}x${h}  tema ${tema} =====`);
      for (const [hash,nombre] of RUTAS) {
        await win.evaluate(x => { window.location.hash = "#" + x; }, hash);
        await win.mouse.move(w - 5, h - 5);
        await win.waitForTimeout(1800);
        const r = await win.evaluate(exc => {
          const oscuro = document.documentElement.classList.contains("dark");
          const lum = c => {
            const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null;
            const [rr,gg,bb,aa] = m[1].split(",").map(parseFloat);
            if (aa !== undefined && aa < 0.5) return null;
            return (0.2126*rr + 0.7152*gg + 0.0722*bb) / 255;
          };
          const out = [];
          for (const el of document.querySelectorAll("*")) {
            const q = el.getBoundingClientRect();
            if (q.width * q.height < 1500) continue;
            const l = lum(getComputedStyle(el).backgroundColor);
            if (l === null) continue;
            if (!(oscuro ? l > 0.75 : l < 0.25)) continue;
            const cls = el.className?.baseVal ?? String(el.className ?? "");
            if (exc.some(e => cls.includes(e))) continue;
            out.push(`${el.tagName.toLowerCase()} ${Math.round(q.width)}x${Math.round(q.height)} «${cls.slice(0,60)}»`);
          }
          const main = document.querySelector("main");
          return { raras: out.slice(0,4), desborde: main ? main.scrollHeight - main.clientHeight : 0 };
        }, EXCEPCIONES);

        const permitido = SE_DESPLAZAN.has(nombre) || (nombre === "portada" && h === 640);
        const malDesborde = r.desborde > 0 && !permitido;
        if (malDesborde) desbordes++;
        sospechas += r.raras.length;
        const notas = [];
        if (r.desborde > 0) notas.push(permitido ? `scroll ${r.desborde}px (esperado)` : `DESBORDA ${r.desborde}px`);
        if (r.raras.length) notas.push(`${r.raras.length} a contracorriente`);
        console.log(`  ${nombre.padEnd(12)} ${notas.length ? notas.join("  ") : "ok"}`);
        r.raras.forEach(x => console.log(`        ${x}`));
      }
    }
  }
  console.log(`\n==========================================`);
  console.log(`cajas a contracorriente del tema: ${sospechas}`);
  console.log(`pantallas que desbordan sin deber: ${desbordes}`);
  await app.close();
  // Codigo de salida, para poder encadenarlo en npm run test:ui y en CI.
  process.exit(sospechas === 0 && desbordes === 0 ? 0 : 1);
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
