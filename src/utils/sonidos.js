// Efectos de sonido de los juegos, sintetizados con Web Audio: no hay archivos
// de audio que empaquetar y funcionan sin internet.
import { leerJSON, guardarJSON } from "./almacen";

const CLAVE_PREFS = "signai_audio_juegos";
const PREFS_DEFECTO = { efectos: true, voz: true };

export function leerPrefsAudio() {
  return { ...PREFS_DEFECTO, ...(leerJSON(CLAVE_PREFS, null) || {}) };
}

export function guardarPrefsAudio(prefs) {
  guardarJSON(CLAVE_PREFS, prefs);
}

let ctx = null;
function contexto() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  // Chromium suspende el contexto hasta que hay un gesto del usuario; los
  // sonidos siempre se disparan desde un clic, así que aquí se reanuda.
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

// Una nota corta con ataque y caída suaves (sin chasquidos).
function nota(ac, frecuencia, inicio, duracion, { tipo = "sine", volumen = 0.18 } = {}) {
  const osc = ac.createOscillator();
  const gan = ac.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(frecuencia, inicio);
  gan.gain.setValueAtTime(0.0001, inicio);
  gan.gain.exponentialRampToValueAtTime(volumen, inicio + 0.015);
  gan.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion);
  osc.connect(gan).connect(ac.destination);
  osc.start(inicio);
  osc.stop(inicio + duracion + 0.02);
}

const MELODIAS = {
  // Dos notas que suben: "¡bien!"
  acierto: [[660, 0, 0.12], [990, 0.09, 0.22]],
  // Dos notas graves que bajan, suaves: que no regañe.
  error: [[330, 0, 0.16, "triangle"], [247, 0.13, 0.26, "triangle"]],
  // Arpegio corto al terminar la partida.
  fin: [[523, 0, 0.14], [659, 0.12, 0.14], [784, 0.24, 0.14], [1047, 0.36, 0.4]],
};

export function sonar(tipo) {
  if (!leerPrefsAudio().efectos) return;
  const melodia = MELODIAS[tipo];
  const ac = contexto();
  if (!melodia || !ac) return;
  const t0 = ac.currentTime + 0.01;
  for (const [f, desfase, dur, forma] of melodia) {
    nota(ac, f, t0 + desfase, dur, { tipo: forma || "sine" });
  }
}
