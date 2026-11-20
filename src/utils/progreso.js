import { useEffect, useRef, useState } from "react";
import { leerJSON, guardarJSON } from "./almacen";

// Progreso de quien juega, guardado en esta compu:
//  - días en que jugó (para la racha),
//  - por juego: partidas, récord (%) y última partida,
//  - por letra/palabra: aciertos y fallos (para saber qué le cuesta).
//
// REGLA: nada de aquí puede tumbar un juego. Cada función pública atrapa sus
// errores; lo peor que pasa es que no se guarde una respuesta.

const CLAVE = "signai.progreso";
const EVENTO = "signai-progreso";
const MAX_DIAS = 120;

export const NOMBRE_JUEGO = {
  memorama: "Memorama",
  quiz: "Quiz visual",
  desafio: "Modo desafío",
  deletreo: "Deletreo",
  sino: "¿Sí o no?",
  letrafalta: "Letra que falta",
  repasoabc: "Repaso ABC",
};

const vacio = () => ({ dias: [], juegos: {}, items: {} });

const esObjeto = (v) => v && typeof v === "object" && !Array.isArray(v);

export function leerProgreso() {
  try {
    const p = leerJSON(CLAVE, null);
    if (!esObjeto(p)) return vacio();
    return {
      dias: Array.isArray(p.dias) ? p.dias.filter((d) => typeof d === "string") : [],
      juegos: esObjeto(p.juegos) ? p.juegos : {},
      items: esObjeto(p.items) ? p.items : {},
    };
  } catch {
    return vacio();
  }
}

function guardarProgreso(p) {
  guardarJSON(CLAVE, p);
  try {
    window.dispatchEvent(new Event(EVENTO));
  } catch {
    /* nada */
  }
}

// Fecha local (no UTC: a las 7 pm en México UTC ya es "mañana").
export const fechaLocal = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hoy = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function marcarHoy(p) {
  const h = hoy();
  if (p.dias[p.dias.length - 1] !== h) {
    p.dias = [...p.dias.filter((d) => d !== h), h].slice(-MAX_DIAS);
  }
}

const normalizar = (item) => String(item ?? "").trim().toUpperCase();

/** Una respuesta dentro de un juego (letra o palabra, acertada o no). */
export function registrarRespuesta(item, correcto) {
  try {
    const clave = normalizar(item);
    if (!clave) return;
    const p = leerProgreso();
    const it = esObjeto(p.items[clave]) ? p.items[clave] : { ok: 0, mal: 0 };
    if (correcto) it.ok = (Number(it.ok) || 0) + 1;
    else it.mal = (Number(it.mal) || 0) + 1;
    it.ultima = Date.now();
    p.items[clave] = it;
    marcarHoy(p);
    guardarProgreso(p);
  } catch (err) {
    console.warn("[SignAI] no se pudo guardar la respuesta:", err);
  }
}

/** Fin de una partida. Devuelve true si fue récord nuevo. */
export function registrarPartida(juego, aciertos, total) {
  try {
    if (!juego || !(total > 0)) return false;
    const pct = Math.max(0, Math.min(100, Math.round((aciertos / total) * 100)));
    const p = leerProgreso();
    const j = esObjeto(p.juegos[juego]) ? p.juegos[juego] : { partidas: 0, mejor: 0 };
    const record = (Number(j.partidas) || 0) > 0 && pct > (Number(j.mejor) || 0);
    j.partidas = (Number(j.partidas) || 0) + 1;
    j.mejor = Math.max(Number(j.mejor) || 0, pct);
    j.ultimo = pct;
    j.fecha = Date.now();
    p.juegos[juego] = j;
    marcarHoy(p);
    guardarProgreso(p);
    return record;
  } catch (err) {
    console.warn("[SignAI] no se pudo guardar la partida:", err);
    return false;
  }
}

export function borrarProgreso() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* nada */
  }
  try {
    window.dispatchEvent(new Event(EVENTO));
  } catch {
    /* nada */
  }
}

const LETRAS = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");

/** Números listos para mostrar. Nunca lanza. */
export function resumir(p) {
  try {
    // Racha: días seguidos hasta hoy; si hoy aún no juega, cuenta hasta ayer
    // (la racha sigue viva hasta que termine el día).
    const set = new Set(p.dias);
    const d = new Date();
    if (!set.has(hoy(d))) d.setDate(d.getDate() - 1);
    let racha = 0;
    while (set.has(hoy(d))) {
      racha++;
      d.setDate(d.getDate() - 1);
    }

    const partidas = Object.values(p.juegos).reduce((s, j) => s + (Number(j?.partidas) || 0), 0);

    const dominada = (it) => it && it.ok >= 2 && it.ok / (it.ok + (it.mal || 0)) >= 0.7;
    const letrasDominadas = LETRAS.filter((l) => dominada(p.items[l])).length;

    // Lo que más cuesta: más fallos que aciertos, ordenado por fallos.
    const dificiles = Object.entries(p.items)
      .filter(([, it]) => esObjeto(it) && (it.mal || 0) > 0 && (it.mal || 0) >= (it.ok || 0))
      .sort((a, b) => (b[1].mal || 0) - (a[1].mal || 0))
      .slice(0, 4)
      .map(([k]) => k);

    return { racha, partidas, letrasDominadas, totalLetras: LETRAS.length, dificiles, jugoHoy: set.has(hoy()) };
  } catch {
    return { racha: 0, partidas: 0, letrasDominadas: 0, totalLetras: LETRAS.length, dificiles: [], jugoHoy: false };
  }
}

/** Progreso actual; se refresca solo cuando algún juego guarda. */
export function useProgreso() {
  const [p, setP] = useState(leerProgreso);
  useEffect(() => {
    const alCambiar = () => setP(leerProgreso());
    window.addEventListener(EVENTO, alCambiar);
    return () => window.removeEventListener(EVENTO, alCambiar);
  }, []);
  return p;
}

/**
 * Guarda la partida una sola vez cuando `terminado` pasa a true, y vuelve a
 * armarse si el juego se reinicia. Devuelve si fue récord nuevo.
 */
export function usePartidaTerminada(juego, terminado, aciertos, total) {
  const guardadaRef = useRef(false);
  const [record, setRecord] = useState(false);
  useEffect(() => {
    if (!terminado) {
      guardadaRef.current = false;
      setRecord(false);
      return;
    }
    if (guardadaRef.current) return;
    guardadaRef.current = true;
    setRecord(registrarPartida(juego, aciertos, total));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminado]);
  return record;
}
