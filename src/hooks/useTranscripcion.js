import { useCallback, useMemo, useState } from "react";
import { esLetra } from "../data/palabras";

/**
 * Mantiene el mensaje que se va formando con las señas confirmadas.
 *
 * El modelo emite dos cosas distintas por el mismo canal: letras del alfabeto
 * (deletreo) y palabras completas (AGUA, HOLA, PERRO). Encadenarlas requiere
 * reglas distintas, así que cada commit se guarda como una **entrada** y el
 * texto visible se deriva de ellas.
 *
 * Guardar entradas en vez de una cadena tiene una ventaja concreta: "Borrar"
 * quita la última seña completa. Una palabra como PERRO desaparece de un golpe
 * en lugar de exigir cinco pulsaciones.
 *
 * @returns {{
 *   texto: string,
 *   vacio: boolean,
 *   ultimaPalabra: string,
 *   deletreando: boolean,
 *   agregar: (sena: string) => void,
 *   espacio: () => void,
 *   borrar: () => void,
 *   limpiar: () => void,
 * }}
 */
export default function useTranscripcion() {
  const [entradas, setEntradas] = useState([]);

  const agregar = useCallback((sena) => {
    const valor = String(sena || "").trim().toUpperCase();
    if (!valor) return;
    setEntradas((prev) => [
      ...prev,
      { valor, tipo: esLetra(valor) ? "letra" : "palabra" },
    ]);
  }, []);

  // Dos espacios seguidos no aportan nada y descuadran el texto.
  const espacio = useCallback(() => {
    setEntradas((prev) =>
      prev.length === 0 || prev[prev.length - 1].tipo === "espacio"
        ? prev
        : [...prev, { valor: " ", tipo: "espacio" }]
    );
  }, []);

  const borrar = useCallback(() => {
    setEntradas((prev) => prev.slice(0, -1));
  }, []);

  const limpiar = useCallback(() => setEntradas([]), []);

  const texto = useMemo(() => componer(entradas), [entradas]);

  // Lo último que se escribió, para poder pronunciarlo al cerrar la palabra.
  const ultimaPalabra = useMemo(() => {
    const partes = texto.trim().split(/\s+/);
    return partes[partes.length - 1] || "";
  }, [texto]);

  return {
    texto,
    vacio: entradas.length === 0,
    ultimaPalabra,
    // Si lo último fue una letra, hay una palabra a medio deletrear que
    // todavía no se ha pronunciado.
    deletreando: entradas[entradas.length - 1]?.tipo === "letra",
    agregar,
    espacio,
    borrar,
    limpiar,
  };
}

/**
 * Convierte las entradas en el texto visible.
 *
 * Las letras se pegan entre sí, que es de lo que va el deletreo: A+G+U+A da
 * "AGUA". Las palabras, en cambio, son unidades cerradas y nunca se pegan a lo
 * que tengan al lado: sin esa separación "HOLA" seguido de "A" se leería
 * "HOLAA".
 */
export function componer(entradas) {
  return entradas.reduce((acc, entrada, i) => {
    if (entrada.tipo === "espacio") return acc + " ";

    const previa = entradas[i - 1];
    const separar =
      previa &&
      previa.tipo !== "espacio" &&
      (entrada.tipo === "palabra" || previa.tipo === "palabra");

    return acc + (separar ? " " : "") + entrada.valor;
  }, "");
}
