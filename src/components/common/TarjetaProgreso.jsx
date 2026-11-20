import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Flame, Trophy, Type, ArrowRight } from "lucide-react";
import { useProgreso, resumir } from "../../utils/progreso";
import useKidMode from "../../hooks/useKidMode";
import { tr, palabraSena } from "../../i18n";

// Resumen del progreso en el inicio. No aparece hasta la primera partida.
export default function TarjetaProgreso({ className = "" }) {
  const progreso = useProgreso();
  const kid = useKidMode();
  const navigate = useNavigate();
  const r = resumir(progreso);

  if (!r.partidas && !Object.keys(progreso.items).length) return null;

  const fuente = kid ? "font-comic" : "";
  const dato = (Icono, tono, valor, etiqueta) => (
    <div className="flex items-center gap-2 min-w-0">
      <span
        className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center bg-[rgb(var(--tono))]/[0.14]"
        style={{ "--tono": `var(--cat-${tono})` }}
      >
        <Icono className="w-[18px] h-[18px] text-[rgb(var(--tono))]" />
      </span>
      <div className="leading-tight min-w-0">
        <div className={`font-bold text-texto text-base 2xl:text-lg ${fuente}`}>{valor}</div>
        <div className={`text-xs 2xl:text-sm text-sutil truncate ${fuente}`}>{etiqueta}</div>
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className={`bg-superficie border border-borde rounded-2xl shadow-sm p-3 sm:p-4 text-left ${className}`}
    >
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {dato(Flame, 7, r.racha ? `${r.racha} ${r.racha === 1 ? tr("día") : tr("días")}` : "—", r.racha ? (r.jugoHoy ? tr("de racha 🔥") : tr("¡juega hoy!")) : tr("sin racha"))}
        {dato(Trophy, 8, r.partidas, r.partidas === 1 ? tr("partida") : tr("partidas"))}
        {dato(Type, 1, `${r.letrasDominadas}/${r.totalLetras}`, tr("letras dominadas"))}
      </div>

      {r.dificiles.length > 0 && (
        <div className="mt-3 pt-3 border-t border-borde flex flex-wrap items-center gap-2">
          <span className={`text-xs sm:text-sm text-sutil ${fuente}`}>{tr("Te cuestan:")}</span>
          {r.dificiles.map((d) => (
            <span key={d} className={`px-2 py-0.5 rounded-md bg-superficie-2 text-xs sm:text-sm font-semibold text-texto ${fuente}`}>
              {d.length > 1 ? palabraSena(d).charAt(0) + palabraSena(d).slice(1).toLowerCase() : d}
            </span>
          ))}
          <button
            onClick={() => navigate("/Juegos")}
            className={`ml-auto inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-acento hover:underline underline-offset-4 ${fuente}`}
          >{tr("Practicar")}{" "}<ArrowRight size={14} />
          </button>
        </div>
      )}
    </motion.div>
  );
}
