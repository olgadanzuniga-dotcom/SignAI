import React from "react";
import { useIdioma } from "../../i18n";

// Cabecera de progreso de los juegos: descripción, píldoras de estadísticas
// y barra de avance. Cada píldora es { punto, contenido }: `punto` son las
// clases de color del puntito y `contenido` el texto (nodo).
//
// La barra usa el degradado de la marca (--degradado-marca), que sale de la
// misma rampa que ordena el temario. Antes iba de índigo a celeste y verde,
// tres colores elegidos aquí y en ningún otro sitio de la app.
export default function ProgressHeader({
  dataTutorial,
  descripcion,
  pills = [],
  progreso = 0,
  className = "mb-8",
}) {
  const { t } = useIdioma();
  return (
    <div
      data-tutorial={dataTutorial}
      className={`w-full text-center flex flex-col items-center ${className}`}
    >
      <p className="mt-2 text-base sm:text-lg 2xl:text-xl font-medium text-texto/80 max-w-2xl">
        {t(descripcion)}
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-sm sm:text-base 2xl:text-lg">
        {pills.map((pill, i) => (
          <div
            key={i}
            className="px-4 py-1.5 rounded-full bg-superficie border border-borde shadow-md flex items-center gap-2"
          >
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${pill.punto}`} />
            <span className="font-bold text-texto">
              {pill.contenido}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 w-full max-w-lg mx-auto">
        <div className="h-3 w-full rounded-full bg-superficie-2 overflow-hidden shadow-inner">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progreso}%`, backgroundImage: "var(--degradado-marca)" }}
          />
        </div>
      </div>
    </div>
  );
}
