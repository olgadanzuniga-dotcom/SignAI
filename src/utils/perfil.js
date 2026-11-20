import { useEffect, useState } from "react";
import { leerJSON, guardarJSON } from "./almacen";

// Perfil local de quien usa la app: su nombre dibujado a mano (trazos) y,
// opcional, escrito. Vive solo en esta computadora, sin cuentas ni internet.
//
// { nombre: "Ana", trazos: [[[x,y],...], ...], tinta: "marca", creado: ISO }
// `omitido: true` = la persona saltó la bienvenida; no se le vuelve a pedir.

const CLAVE = "signai.perfil";
const EVENTO = "signai-perfil";

export function leerPerfil() {
  const p = leerJSON(CLAVE, null);
  if (!p || typeof p !== "object" || !Array.isArray(p.trazos)) return null;
  return p;
}

export function guardarPerfil(perfil) {
  guardarJSON(CLAVE, { ...perfil, creado: new Date().toISOString() });
  window.dispatchEvent(new Event(EVENTO));
}

export function borrarPerfil() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* sin almacenamiento: no hay nada que borrar */
  }
  window.dispatchEvent(new Event(EVENTO));
}

/** Perfil actual; se actualiza solo cuando se guarda o borra en otra pantalla. */
export function usePerfil() {
  const [perfil, setPerfil] = useState(leerPerfil);
  useEffect(() => {
    const alCambiar = () => setPerfil(leerPerfil());
    window.addEventListener(EVENTO, alCambiar);
    return () => window.removeEventListener(EVENTO, alCambiar);
  }, []);
  return perfil;
}
