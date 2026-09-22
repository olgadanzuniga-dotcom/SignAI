import { useEffect, useState } from "react";

/**
 * Se suscribe a una media query y devuelve si se cumple ahora mismo.
 *
 * Existe porque hay decisiones de disposición que no se pueden tomar solo con
 * clases de Tailwind: la barra lateral, por ejemplo, tiene que **empujar** el
 * contenido en una ventana ancha y **superponerse** en una estrecha, y eso
 * cambia el marcado (aparece un velo pulsable), no solo el estilo.
 *
 * El valor inicial se lee de forma síncrona para que no haya un primer render
 * con la disposición equivocada.
 */
export default function useMediaQuery(query) {
  const [coincide, setCoincide] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const alCambiar = (e) => setCoincide(e.matches);
    setCoincide(mq.matches); // por si cambió entre el render y el efecto
    mq.addEventListener("change", alCambiar);
    return () => mq.removeEventListener("change", alCambiar);
  }, [query]);

  return coincide;
}

// Umbral único de "ventana estrecha". Coincide con el `lg` de Tailwind (1024),
// que es donde las cuadrículas pasan a tres columnas: por debajo de ahí no
// sobran 240px para la barra lateral.
export const CONSULTA_ESTRECHA = "(max-width: 1023px)";
