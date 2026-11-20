import React from "react";
import { motion } from "framer-motion";
import { useIdioma } from "../../i18n";

/**
 * Tarjeta de una categoría, en las cuadrículas de Aprender, Aprendizaje y
 * Juegos.
 *
 * El color de la categoría entra como una **banda en el canto**: presente y
 * rotundo, pero contenido en una zona estrecha. Es lo que permite que nueve
 * colores convivan en la misma pantalla sin cansar — lo que fatiga no es el
 * color, es cuánta superficie cubre.
 *
 * Todas las medidas van en `clamp()` y no en pasos fijos: la tarjeta crece de
 * verdad con la pantalla en vez de quedarse pequeña en un monitor grande y
 * dejar la mitad del alto vacío. Se dimensionan con `style` y no con clases
 * porque los `clamp()` llevan comas y en utilidades arbitrarias hay que
 * escaparlas, lo que las vuelve ilegibles.
 *
 * Es un `<button>` de verdad, no un `<div onClick>`: un div no recibe foco ni
 * se activa con Enter, así que la cuadrícula entera era inalcanzable con
 * teclado — y esta es, entre todas, la app que menos se lo puede permitir.
 *
 * ## Por qué hay dos variantes
 *
 * La cuadrícula reparte el alto entre sus filas, así que cuantas menos
 * tarjetas haya, más altas salen. Con las nueve categorías de Aprender la fila
 * mide 171px y la tarjeta funciona como un renglón: icono a la izquierda,
 * nombre al lado. Con las dos de Aprendizaje la misma tarjeta medía 545px de
 * alto para sostener un icono de 69px y una palabra — parecía sin terminar, y
 * no por falta de contenido sino porque una fila estirada cuatro veces sigue
 * siendo una fila.
 *
 * - `"fila"` — muchas opciones que se recorren con la vista. Icono al lado del
 *   nombre.
 * - `"tarjeta"` — pocas opciones grandes (Aprendizaje, Juegos). Icono arriba y
 *   nombre debajo, centrados: llena la tarjeta en vez de dejarla vacía.
 *
 * En las dos, **la placa mide en % del alto de la tarjeta y no en `vw`**. Antes
 * daba 69px fuera cual fuera la tarjeta, así que en las grandes quedaba
 * diminuta y flotando; ese 50% reproduce exactamente esos 69px en la
 * cuadrícula de nueve y mantiene la proporción en las demás.
 *
 * @param {{ tono: number, variante?: "fila" | "tarjeta" }} props `tono` es la
 *   posición en la rampa (1-9), que sigue el orden del temario.
 */
export default function CategoriaCard({
  titulo,
  img,
  tono = 1,
  onClick,
  tutorialKey,
  variante = "fila",
}) {
  const { t } = useIdioma();
  const esTarjeta = variante === "tarjeta";

  return (
    <motion.button
      type="button"
      data-tutorial={tutorialKey}
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      style={{
        "--tono": `var(--cat-${tono})`,
        // Tope de alto: sin él, dos tarjetas se reparten toda la pantalla y
        // salen desproporcionadas. La variante grande admite más porque su
        // contenido crece con ella.
        maxHeight: esTarjeta
          ? "clamp(9rem, 42vh, 26rem)"
          : "clamp(6.5rem, 32vh, 20rem)",
        padding: "clamp(0.7rem, 1.3vw, 1.75rem)",
        gap: "clamp(0.7rem, 1.3vw, 1.75rem)",
        borderRadius: "clamp(0.75rem, 1vw, 1.4rem)",
        borderLeftWidth: "clamp(4px, 0.35vw, 9px)",
      }}
      className={`group relative flex h-full w-full overflow-hidden border border-borde
                  border-l-[rgb(var(--tono))] bg-superficie
                  shadow-sm transition-all duration-200
                  hover:bg-superficie-2 hover:shadow-md ${
                    esTarjeta
                      ? "flex-col items-center justify-center text-center"
                      : "items-center text-left"
                  }`}
    >
      {/* Lavado muy sutil del tono sobre toda la tarjeta: la liga con la
          banda del canto sin cubrir suficiente superficie como para cansar
          entre las nueve categorías (ver nota de arriba). */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[rgb(var(--tono))]/[0.05] dark:bg-[rgb(var(--tono))]/[0.08]"
      />

      {/* La placa lleva el mismo tono a baja opacidad: liga el icono con la
          banda sin añadir otra mancha de color fuerte. */}
      <span
        className="relative grid shrink-0 place-items-center bg-[rgb(var(--tono))]/[0.16] shadow-inner transition-transform duration-200 group-hover:scale-105"
        style={{
          height: esTarjeta ? "55%" : "50%",
          width: "auto",
          aspectRatio: "1",
          borderRadius: "clamp(0.6rem, 0.95vw, 1.4rem)",
        }}
      >
        <img src={img} alt="" aria-hidden="true" className="h-[62%] w-[62%] object-contain" />
      </span>

      <span
        className={`min-w-0 font-semibold text-texto ${esTarjeta ? "" : "flex-1"}`}
        style={{ fontSize: "clamp(0.95rem, 1.35vw, 1.7rem)", lineHeight: 1.25 }}
      >
        {t(titulo)}
      </span>
    </motion.button>
  );
}
