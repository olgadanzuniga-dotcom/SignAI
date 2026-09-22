import React from "react";
import { motion } from "framer-motion";

/**
 * Marco de una pantalla estándar.
 *
 * Antes pintaba un degradado animado a pantalla completa (`AnimatedBackground`,
 * ya eliminado). Se quitó a propósito: ese fondo azul-celeste era el color más
 * grande de la app y contradecía la dirección visual — el color va en las
 * bandas de las tarjetas, y el fondo se queda quieto para que se lea durante
 * horas sin cansar. El fondo lo pone ahora el token `--fondo`.
 */
export default function PageLayout({
  children,
  className = "",
  contentClassName = "",
  contentStyle,
}) {
  return (
    <div className={`isolate flex w-full flex-1 flex-col bg-fondo text-texto ${className}`}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        // `contentStyle` es la puerta para el ritmo vertical en `clamp()`: los
        // rellenos de las pantallas de juego tienen que encoger con la ventana
        // y las utilidades arbitrarias de Tailwind con comas dentro se vuelven
        // ilegibles a base de escapes.
        style={contentStyle}
        className={`flex w-full flex-1 flex-col ${contentClassName}`}
      >
        {children}
      </motion.div>
    </div>
  );
}
