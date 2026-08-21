const { _electron: electron } = require("playwright-core");
const path = require("path");

// Raiz del repo, para que el script funcione desde cualquier sitio.
const RAIZ = path.resolve(__dirname, "..", "..");

const RUTAS = [
  ["/", "portada"], ["/Aprender", "aprender"], ["/Aprendizaje", "aprendizaje"],
  ["/Juegos", "juegos"], ["/Deletreo", "deletreo"], ["/Desafio", "desafio"],
  ["/Memorama", "memorama"], ["/Quiz", "quiz"], ["/Ajustes", "ajustes"],
];

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
  await win.waitForFunction(
    () => location.protocol !== "about:" && !!document.querySelector("#root > *"),
    null, { timeout: 60000 });
  await win.evaluate(() => {
    ["tourSignAICompleted","tourSignAI_aprender","tourSignAI_ajustes","tourSignAI_acerca",
     "tourSignAI_quiz","tourSignAI_memorama","tourSignAI_deletreo","tourSignAI_desafio",
     "tourSignAI_juegos","tourSignAI_aprendizaje","tourSignAI_leccion_intro",
     "tourSignAI_leccion_camara","tourSignAI_camara"].forEach(k => localStorage.setItem(k,"true"));
  });
  await win.setViewportSize({ width: 1280, height: 720 });
  await win.evaluate(() => {
    localStorage.setItem("lsm_theme","dark");
    document.documentElement.classList.add("dark");
  });
  // Raton fuera de todo, para que no salga nada en :hover.
  await win.mouse.move(640, 400);

  for (const [hash, nombre] of RUTAS) {
    await win.evaluate(h => { window.location.hash = "#" + h; }, hash);
    await win.waitForTimeout(2200);
    const r = await win.evaluate(() => {
      const main = document.querySelector("main");
      const out = {
        desborde: main ? main.scrollHeight - main.clientHeight : null,
        tarjetas: [],
        barra: null,
        fondoBody: getComputedStyle(document.body).backgroundColor,
      };
      // tarjetas de cuadricula
      document.querySelectorAll("button.group").forEach(b => {
        const q = b.getBoundingClientRect();
        if (q.width * q.height < 5000) return;
        const plato = b.querySelector("span.grid");
        const pr = plato ? plato.getBoundingClientRect() : null;
        out.tarjetas.push({
          caja: `${Math.round(q.width)}x${Math.round(q.height)}`,
          plato: pr ? Math.round(pr.width) : null,
          ratio: pr ? +(pr.height / q.height).toFixed(2) : null,
        });
      });
      // barra de progreso de los juegos
      const track = document.querySelector(".max-w-md > .rounded-full");
      if (track) {
        const cs = getComputedStyle(track);
        const q = track.getBoundingClientRect();
        out.barra = {
          bg: cs.backgroundColor,
          sombra: cs.boxShadow,
          caja: `${Math.round(q.width)}x${Math.round(q.height)}`,
          clases: track.className,
        };
      }
      // ultimo elemento del flujo: cuanto le queda al borde inferior
      const vh = window.innerHeight;
      let masBajo = 0, quien = "";
      document.querySelectorAll("*").forEach(el => {
        const q = el.getBoundingClientRect();
        if (q.width * q.height < 3000) return;
        if (q.bottom > masBajo && q.bottom <= vh + 300) {
          masBajo = q.bottom;
          quien = el.tagName.toLowerCase() + " ." + String(el.className||"").slice(0,45);
        }
      });
      out.margenAbajo = Math.round(vh - masBajo);
      out.masBajo = quien;
      return out;
    });
    console.log(`\n== ${nombre} ==`);
    console.log(`   desborde de main: ${r.desborde}px   margen inferior: ${r.margenAbajo}px`);
    console.log(`   mas bajo: ${r.masBajo}`);
    if (r.barra) console.log(`   barra: ${r.barra.caja} bg=${r.barra.bg} «${r.barra.clases}»`);
    r.tarjetas.slice(0, 4).forEach(t =>
      console.log(`   tarjeta ${t.caja}  plato=${t.plato}px  plato/alto=${t.ratio}`));
  }
  await app.close();
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
