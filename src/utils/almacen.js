/**
 * Acceso a `localStorage` que no puede tumbar la app.
 *
 * Parece paranoia y no lo es: `localStorage` lanza si el perfil de Chromium
 * está corrupto, si el disco está lleno (`QuotaExceededError` al escribir) o
 * si el almacenamiento está deshabilitado. Y la primera lectura del tema pasa
 * en `main.jsx` **antes** de que React monte nada, así que ahí una excepción
 * no la atrapa ningún ErrorBoundary: la ventana se queda en blanco y, sin
 * barra de direcciones ni menú, no hay forma de salir.
 *
 * Perder una preferencia es un mal menor perfectamente asumible; perder la
 * aplicación entera, no.
 */
export function leer(clave, porDefecto = null) {
  try {
    const v = localStorage.getItem(clave);
    return v === null ? porDefecto : v;
  } catch (err) {
    console.warn(`[SignAI] no se pudo leer «${clave}» de localStorage:`, err);
    return porDefecto;
  }
}

export function guardar(clave, valor) {
  try {
    localStorage.setItem(clave, valor);
    return true;
  } catch (err) {
    console.warn(`[SignAI] no se pudo guardar «${clave}» en localStorage:`, err);
    return false;
  }
}

export function leerJSON(clave, porDefecto) {
  const crudo = leer(clave);
  if (crudo === null) return porDefecto;
  try {
    return JSON.parse(crudo);
  } catch {
    // Un valor corrupto (escritura a medias, edición a mano) no debe dejar la
    // pantalla inservible para siempre: se vuelve al valor por defecto.
    console.warn(`[SignAI] «${clave}» tenía JSON inválido; se ignora.`);
    return porDefecto;
  }
}

export const guardarJSON = (clave, valor) => guardar(clave, JSON.stringify(valor));
