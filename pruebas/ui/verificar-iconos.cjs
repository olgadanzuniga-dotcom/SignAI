// Comprueba que donde habia un emoji hay ahora un icono de verdad (un <svg>
// de lucide) y no solo texto.
const { _electron: electron } = require("playwright-core");
(async () => {
  const app = await electron.launch({ args: ["."], cwd: "C:/LSM Traductor" });
  const win = await app.firstWindow();
  await win.waitForLoadState("domcontentloaded");
  await win.waitForFunction(() => location.protocol !== "about:" && !!document.querySelector("#root > *"), null, { timeout: 60000 });
  await win.evaluate(() => {
    ["tourSignAICompleted","tourSignAI_ajustes","tourSignAI_quiz"].forEach(k => localStorage.setItem(k,"true"));
  });
  await win.setViewportSize({ width: 1280, height: 900 });

  await win.evaluate(() => { window.location.hash = "#/Ajustes"; });
  await win.waitForTimeout(2500);
  const ajustes = await win.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(x => /Probar voz|Detener/.test(x.textContent));
    return b ? { texto: b.textContent.trim(), svg: [...b.querySelectorAll("svg")].map(s => s.getAttribute("class")) } : null;
  });
  console.log("Ajustes / boton de voz:", JSON.stringify(ajustes));

  await win.evaluate(() => { window.location.hash = "#/Quiz"; });
  await win.waitForTimeout(2500);
  const quiz = await win.evaluate(() => {
    const s = [...document.querySelectorAll("span")].find(x => /^\d+$/.test(x.textContent.trim()) && x.querySelector("svg"));
    return s ? { texto: s.textContent.trim(), svg: s.querySelector("svg").getAttribute("class") } : null;
  });
  console.log("Quiz / marcador:", JSON.stringify(quiz));

  // Texto plano visible en toda la app: ni un emoji.
  for (const h of ["/", "/Ajustes", "/Quiz", "/Deletreo", "/Juegos", "/Aprender", "/Aprendizaje", "/Acerca", "/Memorama", "/Desafio"]) {
    await win.evaluate(x => { window.location.hash = "#" + x; }, h);
    await win.waitForTimeout(1400);
    const encontrados = await win.evaluate(() => {
      const re = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2190}-\u{21FF}\u{2713}\u{2714}\u{23F9}]/gu;
      const m = (document.body.innerText || "").match(re);
      return m ? [...new Set(m)] : [];
    });
    if (encontrados.length) console.log(`  EMOJI en ${h}: ${encontrados.join(" ")}`);
  }
  console.log("barrido de emojis en el texto visible: terminado");
  await app.close();
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
