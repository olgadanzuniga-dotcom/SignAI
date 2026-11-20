import React from "react";
import { NavLink } from "react-router-dom";
import { X, Hand, Settings, BookOpen, HelpCircle, Lock } from "lucide-react";
import useKidMode from "../hooks/useKidMode";
import { useIdioma } from "../i18n";
import btnTraductor from "../assets/kid/btn-traductor.png";
import btnAprendizaje from "../assets/kid/btn-aprendizaje.png";
import btnAjustes from "../assets/kid/btn-ajustes.png";
import btnAyuda from "../assets/kid/btn-ayuda.png";
import logoSidebar from "../assets/kid/logo-sidebar.png";

const ENLACES = [
  { to: "/", end: true, icono: Hand, texto: "Traductor", tutorial: "traductor", kidImg: btnTraductor },
  { to: "/Aprendizaje", icono: BookOpen, texto: "Aprendizaje", tutorial: "aprendizaje", kidImg: btnAprendizaje },
  { to: "/Ajustes", icono: Settings, texto: "Ajustes", tutorial: "ajustes", kidImg: btnAjustes },
  { to: "/Acerca", icono: HelpCircle, texto: "Acerca de nosotros", kidTexto: "Ayuda", tutorial: "acerca", kidImg: btnAyuda },
];

const BASE =
  "group flex items-center gap-3 rounded-lg px-4 py-2 font-medium transition-all duration-200";

/**
 * Menú lateral.
 *
 * Antes decidía cada color en JavaScript (`isDark ? "bg-[#11131b]" : ...`), lo
 * que le hacía repintar en un `useEffect` y quedarse un instante con el tema
 * anterior al cambiarlo. Ahora los colores son tokens, así que el tema lo
 * resuelve CSS y este componente ya no sabe si es claro u oscuro.
 */
export default function Sidebar({ isOpen, setIsOpen }) {
  // Cerrada, la barra sigue en el DOM (para que la transición se vea) pero
  // desplazada fuera de la pantalla. Sin esto, tabular desde la portada metía
  // el foco en un menú invisible y no había forma de saber dónde estaba.
  const oculto = isOpen ? undefined : -1;
  const kidMode = useKidMode();
  const { t, en } = useIdioma();

  return (
    <aside
      aria-hidden={!isOpen}
      aria-label={t("Menú principal")}
      className={`fixed left-0 top-0 z-40 flex h-full w-60 max-w-[80vw] flex-col justify-between
                  shadow-md transition-transform duration-300
                  ${kidMode ? "rounded-r-[2rem] overflow-hidden bg-gradient-to-b from-sky-500 to-blue-600" : "border-r border-borde bg-superficie"}
                  ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
    >
      {kidMode && (
        <>
          <span className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <span className="absolute bottom-24 -left-10 w-32 h-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        </>
      )}
      <div>
        <div
          className={`flex items-center justify-between px-4 py-4 ${
            kidMode ? "border-b border-white/20" : "border-b border-borde"
          }`}
        >
          {kidMode ? (
            <img src={logoSidebar} alt="SignAI" className="h-16 w-auto max-w-[180px] object-contain" />
          ) : (
            <h1 className="text-lg font-bold text-acento">SignAI</h1>
          )}
          <button
            onClick={() => setIsOpen(false)}
            aria-label={t("Cerrar menú")}
            tabIndex={oculto}
            className={
              kidMode
                ? "leading-none text-white/80 transition hover:text-white"
                : "leading-none text-sutil transition hover:text-texto"
            }
          >
            <X size={22} strokeWidth={2.2} />
          </button>
        </div>

        <nav className={`mt-4 flex flex-col px-2 ${kidMode ? "space-y-3" : "space-y-2"}`}>
          {ENLACES.map(({ to, end, icono: Icono, texto, kidTexto, tutorial, kidImg }) =>
            // Los botones dibujados del modo infantil traen el texto en español:
            // en inglés se usan los botones de texto.
            kidMode && kidImg && !en ? (
              <NavLink
                key={to}
                to={to}
                end={end}
                data-tutorial={tutorial}
                aria-label={kidTexto ?? texto}
                tabIndex={oculto}
                className={({ isActive }) =>
                  `block transition-transform duration-200 hover:scale-[1.04] active:scale-95 ${
                    isActive ? "scale-[1.05] drop-shadow-lg" : ""
                  }`
                }
              >
                <img src={kidImg} alt={kidTexto ?? texto} className="w-full h-auto select-none" draggable={false} />
              </NavLink>
            ) : (
              <NavLink
                key={to}
                to={to}
                end={end}
                data-tutorial={tutorial}
                tabIndex={oculto}
                className={({ isActive }) =>
                  `${BASE} ${
                    kidMode
                      ? isActive
                        ? "scale-[1.02] bg-white text-acento shadow-md"
                        : "text-white/90 hover:bg-white/15"
                      : isActive
                        ? "scale-[1.02] bg-acento text-acento-texto shadow-md"
                        : "text-sutil hover:bg-superficie-2 hover:text-acento"
                  }`
                }
              >
                <Icono
                  size={22}
                  strokeWidth={2}
                  className="transition-transform duration-300 group-hover:scale-110"
                />
                <span className={kidMode ? "font-comic" : ""}>{t(kidMode ? kidTexto ?? texto : texto)}</span>
              </NavLink>
            )
          )}
        </nav>
      </div>

      {kidMode && (
        <div className="relative px-5 py-4">
          {/* Discreto a propósito: es para los adultos, no un botón de juego. */}
          <NavLink
            to="/Tutores"
            tabIndex={oculto}
            className="mb-3 flex items-center justify-center gap-1.5 rounded-full bg-white/15 hover:bg-white/25 px-3 py-1.5 text-xs font-semibold text-white transition"
          >
            <Lock size={13} /> {t("Papás y maestros")}
          </NavLink>
          <svg viewBox="0 0 240 24" preserveAspectRatio="none" className="w-full h-6 -mb-1" aria-hidden="true">
            <path d="M0 24 Q 30 0 60 12 T 120 12 T 180 12 T 240 12 V24 Z" fill="rgba(255,255,255,0.12)" />
          </svg>
          <p className="font-comic text-[11px] font-medium tracking-wide text-center text-white/85">
            {t("A jugar con señas")}
          </p>
        </div>
      )}
    </aside>
  );
}
