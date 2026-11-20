import { useCallback, useEffect, useState } from "react";
import { leer, guardar } from "../utils/almacen";
import EN from "./en";

// Idioma de la interfaz: "es" (por defecto) o "en".
//
// Los textos se escriben en español en el código y se traducen con t():
//   t("Volver")                    -> "Back" en inglés
//   t("Hola, {nombre}", {nombre})  -> "Hi, Ana"
// Si falta una traducción se muestra el español (nunca un hueco ni una clave).
// La Lengua de Señas sigue siendo la Mexicana (LSM) en los dos idiomas: lo que
// cambia es el texto, la voz y la palabra que se escribe al reconocer una seña.

const CLAVE = "signai.idioma";
const EVENTO = "signai-idioma";
export const IDIOMAS = [
  { id: "es", nombre: "Español" },
  { id: "en", nombre: "English" },
];

function leerIdioma() {
  const v = leer(CLAVE);
  return v === "en" ? "en" : "es";
}

let actual = leerIdioma();
if (typeof document !== "undefined") document.documentElement.lang = actual;

export function idiomaActual() {
  return actual;
}

export function setIdioma(id) {
  actual = id === "en" ? "en" : "es";
  guardar(CLAVE, actual);
  if (typeof document !== "undefined") document.documentElement.lang = actual;
  window.dispatchEvent(new Event(EVENTO));
}

function rellenar(texto, vars) {
  if (!vars) return texto;
  return texto.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/** Traducción sin hook (para código fuera de componentes). */
export function tr(es, vars) {
  if (es == null || typeof es !== "string") return es;
  let base = es;
  if (actual === "en") {
    if (Object.prototype.hasOwnProperty.call(EN, es)) base = EN[es];
    else {
      // "Sí, es " -> se busca "Sí, es" y se conservan los espacios de los lados
      const m = es.match(/^(\s*)([\s\S]*?)(\s*)$/);
      if (m && Object.prototype.hasOwnProperty.call(EN, m[2])) base = m[1] + EN[m[2]] + m[3];
    }
  }
  return rellenar(base, vars);
}

/** Palabra de una seña reconocida en el idioma actual (HOLA -> HELLO). */
export function palabraSena(sena) {
  if (actual !== "en" || !sena) return sena;
  return EN_SENAS[sena] || sena;
}

// Señas de palabra que reconoce el traductor. Las letras sueltas no se
// traducen: se deletrean igual.
export const EN_SENAS = {
  HOLA: "HELLO",
  AGUA: "WATER",
  PERRO: "DOG",
  AMARILLO: "YELLOW",
  AZUL: "BLUE",
  ROJO: "RED",
  BUENOS: "GOOD",
  "DÍAS": "MORNING",
  DIAS: "MORNING",
  "BUENOS DÍAS": "GOOD MORNING",
  NOCHES: "NIGHT",
  TARDES: "AFTERNOON",
  GRACIAS: "THANK YOU",
  ADIOS: "BYE",
  "ADIÓS": "BYE",
};

export function useIdioma() {
  const [idioma, setLocal] = useState(actual);
  useEffect(() => {
    const alCambiar = () => setLocal(actual);
    window.addEventListener(EVENTO, alCambiar);
    return () => window.removeEventListener(EVENTO, alCambiar);
  }, []);
  // `idioma` en las dependencias: al cambiar de idioma t() es otra función y
  // los componentes que la usan en efectos/memos se recalculan.
  const t = useCallback((es, vars) => tr(es, vars), [idioma]); // eslint-disable-line react-hooks/exhaustive-deps
  return { idioma, setIdioma, t, en: idioma === "en" };
}
