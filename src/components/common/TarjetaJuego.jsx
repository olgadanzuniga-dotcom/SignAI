import React from "react";
import { motion } from "framer-motion";
import { useIdioma } from "../../i18n";

/**
 * Tarjeta del menú de Juegos. A diferencia de CategoriaCard (sobria, para
 * pantallas que se leen mucho rato), aquí el color cubre toda la tarjeta: los
 * juegos son la parte lúdica de la app y tienen que invitar a tocarlos.
 *
 * El degradado va de un tono de la rampa al siguiente, así que sigue siendo
 * la paleta de SignAI. El texto va en blanco sobre tonos con contraste
 * suficiente (todos los de la rampa lo tienen en claro y en oscuro).
 */
export default function TarjetaJuego({
  titulo,
  descripcion,
  img,
  tono = 1,
  onClick,
  tutorialKey,
  indice = 0,
  record = null, // mejor % guardado, o null si nunca lo ha jugado
}) {
  const { t } = useIdioma();
  const siguiente = (tono % 9) + 1;
  return (
    <motion.button
      type="button"
      data-tutorial={tutorialKey}
      onClick={onClick}
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 22, delay: indice * 0.06 }}
      whileHover={{ y: -6, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      style={{
        backgroundImage: `linear-gradient(135deg, rgb(var(--cat-${tono})), rgb(var(--cat-${siguiente})))`,
        maxHeight: "clamp(10rem, 40vh, 24rem)",
        padding: "clamp(0.9rem, 1.6vw, 2rem)",
        gap: "clamp(0.4rem, 1vh, 1rem)",
        borderRadius: "clamp(1.1rem, 1.6vw, 2rem)",
      }}
      className="group relative flex h-full w-full flex-col items-center justify-center overflow-hidden text-center text-white shadow-lg hover:shadow-2xl transition-shadow duration-300"
    >
      {/* Burbujas decorativas: dan profundidad sin ruido. */}
      <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-14 -left-8 h-36 w-36 rounded-full bg-white/10" />
      <span aria-hidden="true" className="pointer-events-none absolute right-6 bottom-6 h-6 w-6 rounded-full bg-white/20" />

      {record !== null && (
        <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-black/25 backdrop-blur-sm px-2.5 py-1 text-xs sm:text-sm font-bold">
          🏆 {record}%
        </span>
      )}

      <span
        className="relative grid shrink-0 place-items-center rounded-full bg-white shadow-xl transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-110"
        style={{ height: "52%", aspectRatio: "1", maxHeight: "11rem" }}
      >
        <img src={img} alt="" aria-hidden="true" className="h-[64%] w-[64%] object-contain" />
      </span>

      <span
        className="relative font-extrabold drop-shadow-sm"
        style={{ fontSize: "clamp(1.15rem, 1.9vw, 2.2rem)", lineHeight: 1.15 }}
      >
        {t(titulo)}
      </span>
      {descripcion && (
        <span
          className="relative text-white/90 font-medium max-w-[22rem]"
          style={{ fontSize: "clamp(0.78rem, 0.95vw, 1.1rem)", lineHeight: 1.3 }}
        >
          {t(descripcion)}
        </span>
      )}
    </motion.button>
  );
}
