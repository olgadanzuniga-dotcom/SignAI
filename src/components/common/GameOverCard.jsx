import React from "react";
import { motion } from "framer-motion";
import { useIdioma } from "../../i18n";

// Tarjeta de fin de juego compartida por los 4 juegos. El mensaje (y un icono
// opcional) van como children/props; los botones estándar se muestran según
// qué callbacks lleguen, o se puede pasar `acciones` para botones a medida.
export default function GameOverCard({
  titulo,
  tituloClassName = "text-4xl sm:text-5xl 2xl:text-6xl font-extrabold text-acento mb-4 2xl:mb-6",
  className = "p-8 sm:p-12 2xl:p-16 shadow-xl max-w-2xl 2xl:max-w-3xl w-full mx-auto border-borde",
  icono = null,
  children,
  onReiniciar,
  reiniciarLabel = "Jugar de nuevo",
  onSalir,
  salirLabel = "Regresar al menú",
  acciones = null,
}) {
  const { t } = useIdioma();
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`bg-superficie rounded-3xl text-center border ${className}`}
    >
      {icono}
      <h2 className={tituloClassName}>{titulo}</h2>
      {children}
      {acciones || (
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          {onReiniciar && (
            <button
              onClick={onReiniciar}
              className="bg-acento-suave text-acento px-8 py-3 rounded-xl font-bold text-lg hover:bg-superficie-2 transition"
            >
              {t(reiniciarLabel)}
            </button>
          )}
          {onSalir && (
            <button
              onClick={onSalir}
              className="bg-acento text-acento-texto px-8 py-3 rounded-xl font-bold text-lg shadow-lg hover:bg-acento-fuerte transition"
            >
              {t(salirLabel)}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
