import { componer } from "file:///C:/LSM%20Traductor/src/hooks/useTranscripcion.js";
import { esLetra } from "file:///C:/LSM%20Traductor/src/data/palabras.js";

// Simula la secuencia de commits que emite el modelo y compara con lo que
// deberia leerse en pantalla.
const entrada = (v) => ({ valor: v, tipo: esLetra(v) ? "letra" : "palabra" });
const ESPACIO = { valor: " ", tipo: "espacio" };
const seq = (...xs) => componer(xs.map((x) => (x === " " ? ESPACIO : entrada(x))));

const casos = [
  [["A", "G", "U", "A"],            "AGUA",        "deletreo: las letras se encadenan"],
  [["HOLA"],                        "HOLA",        "una palabra sola"],
  [["HOLA", "A"],                   "HOLA A",      "letra tras palabra NO se pega"],
  [["A", "HOLA"],                   "A HOLA",      "palabra tras letra NO se pega"],
  [["HOLA", "PERRO"],               "HOLA PERRO",  "dos palabras seguidas"],
  [["A", " ", "B"],                 "A B",         "espacio manual separa letras"],
  [["R", "R"],                      "RR",          "dos R seguidas (no es la seña RR)"],
  [["RR"],                          "RR",          "la seña RR es una letra"],
  [["Ñ", "O"],                      "ÑO",          "la Ñ es letra y se encadena"],
  [["HOLA", " ", "A", "G", "U", "A"], "HOLA AGUA", "frase real deletreando"],
  [[],                              "",            "vacío"],
];

let fallos = 0;
for (const [entradas, esperado, desc] of casos) {
  const real = seq(...entradas);
  const ok = real === esperado;
  if (!ok) fallos++;
  console.log(`  ${ok ? "OK  " : "FALLA"}  ${JSON.stringify(entradas).padEnd(34)} -> ${JSON.stringify(real).padEnd(14)} ${ok ? "" : `(esperado ${JSON.stringify(esperado)})`}  ${desc}`);
}
console.log(`\n${casos.length - fallos}/${casos.length} correctos`);
process.exit(fallos ? 1 : 0);
