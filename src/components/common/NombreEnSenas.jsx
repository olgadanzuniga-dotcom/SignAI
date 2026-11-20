import React from "react";
import { motion } from "framer-motion";
import { abecedarioLSM } from "../../data/abecedarioLSM";
import { useIdioma } from "../../i18n";

const IMG_LETRA = Object.fromEntries(abecedarioLSM.map((l) => [l.letra, l.img]));

// "Sofía Ñuñez" → ["S","O","F","I","A"," ","Ñ","U","Ñ","E","Z"]
export function letrasDe(nombre) {
  const out = [];
  for (const ch of (nombre || "").toUpperCase().trim()) {
    if (ch === "Ñ") out.push("Ñ");
    else if (/\s/.test(ch)) {
      if (out.length && out[out.length - 1] !== " ") out.push(" ");
    } else {
      const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
      if (/^[A-Z]$/.test(base)) out.push(base);
    }
  }
  return out.slice(0, 24);
}

/**
 * El nombre deletreado con las imágenes del abecedario LSM.
 * tamano: "grande" (bienvenida) | "chico" (inicio, ajustes).
 */
export default function NombreEnSenas({ nombre, tamano = "grande", fuente = "", className = "" }) {
  const { t } = useIdioma();
  const letras = letrasDe(nombre);
  if (!letras.some((l) => l !== " ")) return null;
  const grande = tamano === "grande";

  return (
    <div
      className={`flex flex-wrap gap-2 ${grande ? "justify-center sm:gap-3" : "justify-center md:justify-start"} ${className}`}
    >
      {letras.map((l, i) =>
        l === " " ? (
          <div key={i} className={grande ? "w-full sm:w-4 h-0 sm:h-auto" : "w-2"} />
        ) : (
          <motion.div
            key={`${i}-${l}`}
            initial={{ opacity: 0, y: grande ? 20 : 8, rotateY: 90 }}
            animate={{ opacity: 1, y: 0, rotateY: 0 }}
            transition={{ delay: (grande ? 0.15 : 0.4) + i * (grande ? 0.12 : 0.07), type: "spring", stiffness: 220, damping: 18 }}
            className={`flex flex-col items-center rounded-2xl bg-superficie-2 border border-borde shadow-sm ${
              grande ? "gap-1 w-[4.5rem] sm:w-20 p-2" : "gap-0.5 w-12 sm:w-14 p-1"
            }`}
            title={l}
          >
            {IMG_LETRA[l] ? (
              <img
                src={IMG_LETRA[l]}
                alt={t("Seña de la letra {l}", { l })}
                className="w-full aspect-square object-contain"
                draggable={false}
              />
            ) : (
              // La Ñ no tiene imagen: es seña con movimiento (N + giro).
              <div className={`w-full aspect-square flex items-center justify-center text-sutil leading-tight text-center ${grande ? "text-xs" : "text-[0.55rem]"}`}>
                {t("N con movimiento")}
              </div>
            )}
            <span className={`font-bold text-acento ${grande ? "text-lg" : "text-sm"} ${fuente}`}>{l}</span>
          </motion.div>
        )
      )}
    </div>
  );
}
