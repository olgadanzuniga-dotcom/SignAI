import React from "react";

/**
 * Tarjeta de contenido: la misma superficie, borde y radio que usa el resto de
 * la app. Va lisa a propósito — la banda de color en el canto queda reservada a
 * las tarjetas que se eligen (ver `CategoriaCard`), para que ahí signifique algo
 * en vez de ser decoración repetida en cada caja.
 */
export default function ContentCard({
  children,
  className = "",
  padding = "default",
  as: Tag = "div",
  ...rest
}) {
  const paddings = {
    none: "",
    sm: "p-4 sm:p-5 lg:p-6 2xl:p-8",
    default: "p-6 sm:p-7 lg:p-8 2xl:p-10",
    lg: "p-8 sm:p-10 lg:p-12 2xl:p-16",
  };
  const padCls = paddings[padding] ?? paddings.default;

  return (
    <Tag
      className={`rounded-2xl border border-borde bg-superficie shadow-md 2xl:rounded-3xl 2xl:shadow-xl ${padCls} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
