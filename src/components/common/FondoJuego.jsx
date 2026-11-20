import React from "react";

/**
 * Manchas de color difuminadas detrás de un juego. Quedan por debajo del
 * contenido (z negativo dentro del `isolate` de PageLayout) y no reciben
 * clics. Usan dos tonos de la rampa para que cada juego tenga su color.
 */
export default function FondoJuego({ tono = 1, tono2 = 6 }) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-25 dark:opacity-20"
        style={{ background: `rgb(var(--cat-${tono}))` }}
      />
      <div
        className="absolute -bottom-40 -right-24 h-[32rem] w-[32rem] rounded-full blur-3xl opacity-20 dark:opacity-15"
        style={{ background: `rgb(var(--cat-${tono2}))` }}
      />
      <div
        className="absolute right-[18%] top-[12%] h-40 w-40 rounded-full blur-2xl opacity-15"
        style={{ background: `rgb(var(--cat-${tono2}))` }}
      />
    </div>
  );
}
