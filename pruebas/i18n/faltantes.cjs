// Lista los textos de la app que no tienen traduccion al ingles en src/i18n/en.js.
// uso: node pruebas/i18n/faltantes.cjs
const fs = require("fs"), path = require("path");
const RAIZ = path.resolve(__dirname, "..", "..");
const parser = require(path.join(RAIZ, "node_modules/@babel/parser"));
const traverse = require(path.join(RAIZ, "node_modules/@babel/traverse")).default;
const enSrc = fs.readFileSync(path.join(RAIZ, "src/i18n/en.js"), "utf8").replace("export default EN;", "module.exports = EN;");
const m = { exports: {} }; new Function("module", enSrc)(m); const EN = m.exports;
const PROPS = new Set(["desc","title","text","titulo","descripcion","subtitulo","label","hint","texto","kidTexto","subtitle","description","reiniciarLabel","salirLabel","etiqueta","startLabel","loadingTexto","gender"]);
const faltan = new Map();
const add = (v, p) => { const k = v.trim(); if (!/[A-Za-zÁÉÍÓÚáéíóúñ]/.test(k) || k.length < 2 || /^[a-z0-9:-]+( [a-z0-9:./-]+)+$/.test(k)) return; if (!(k in EN)) faltan.set(k, path.relative(RAIZ, p)); };
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f);
  if (fs.statSync(p).isDirectory()) { if (f !== "i18n") walk(p); continue; }
  if (!/\.(jsx|js)$/.test(f) || /\.bak|test/.test(f)) continue;
  const ast = parser.parse(fs.readFileSync(p, "utf8"), { sourceType: "module", plugins: ["jsx"] });
  traverse(ast, {
    CallExpression(q) { const c = q.node.callee; if (c.type === "Identifier" && (c.name === "t" || c.name === "tr") && q.node.arguments[0]?.type === "StringLiteral") add(q.node.arguments[0].value, p); },
    ObjectProperty(q) { const k = q.node.key; if (PROPS.has(k.name || k.value) && q.node.value.type === "StringLiteral") add(q.node.value.value, p); },
    JSXAttribute(q) { if (PROPS.has(q.node.name.name) && q.node.value?.type === "StringLiteral") add(q.node.value.value, p); },
  });
} })(path.join(RAIZ, "src"));
for (const [k, p] of [...faltan].sort()) console.log(`${p}: ${k}`);
console.log(`\n${faltan.size} textos sin traducir`);
