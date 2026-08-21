import React from "react";
import { NavLink } from "react-router-dom";
import { X, Hand, Settings, BookOpen, HelpCircle } from "lucide-react";

const ENLACES = [
  { to: "/", end: true, icono: Hand, texto: "Traductor", tutorial: "traductor" },
  { to: "/Ajustes", icono: Settings, texto: "Ajustes", tutorial: "ajustes" },
  { to: "/Aprendizaje", icono: BookOpen, texto: "Aprendizaje", tutorial: "aprendizaje" },
  { to: "/Acerca", icono: HelpCircle, texto: "Acerca de nosotros", tutorial: "acerca" },
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
  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-full w-60 flex-col justify-between
                  border-r border-borde bg-superficie shadow-md
                  transition-transform duration-300
                  ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
    >
      <div>
        <div className="flex items-center justify-between border-b border-borde px-4 py-4">
          <h1 className="text-lg font-bold text-acento">SignAI</h1>
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Cerrar menú"
            className="leading-none text-sutil transition hover:text-texto"
          >
            <X size={22} strokeWidth={2.2} />
          </button>
        </div>

        <nav className="mt-4 flex flex-col space-y-2 px-2">
          {ENLACES.map(({ to, end, icono: Icono, texto, tutorial }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              data-tutorial={tutorial}
              className={({ isActive }) =>
                `${BASE} ${
                  isActive
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
              <span>{texto}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  );
}
