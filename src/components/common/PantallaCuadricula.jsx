import React from "react";
import { motion } from "framer-motion";
import PageHeader from "./PageHeader";

/**
 * Pantalla de cuadrícula de tarjetas: Aprender, Aprendizaje y Juegos.
 *
 * Existe para que las tres sean iguales **por construcción** y no por copiar y
 * pegar las mismas clases en tres archivos, que es como se descuadraron antes.
 *
 * Dos cosas que resuelve y conviene no deshacer:
 *
 * - **La cuadrícula llena el alto**, pero con tope. `flex-1` reparte lo que
 *   sobra entre las filas para que las tarjetas no se amontonen arriba
 *   dejando medio monitor vacío. Ahora bien, repartir a secas se pasa de
 *   frenada cuando hay pocas: con dos tarjetas cada una medía 545px de alto
 *   para sostener un icono y una palabra. La tarjeta trae su propio
 *   `maxHeight` y aquí se centran en su fila, así que con nueve llenan la
 *   pantalla y con dos se quedan proporcionadas y centradas.
 * - **El alto lo pone el hueco, no la ventana.** Esta pantalla se usa dentro
 *   de dos marcos distintos, y uno de ellos tiene margen propio: pedir
 *   `h-screen` significaba pedir 48px de más y sacar barra de
 *   desplazamiento.
 * - **Todo escala con la pantalla.** Márgenes, tipografía y separaciones van en
 *   `clamp()` y no en pasos fijos, así que crece de verdad en un monitor grande
 *   sin romperse en el mínimo de 1024×640.
 *
 * @param {{ columnas?: string }} props clases de columnas de Tailwind para la
 *   retícula. Por defecto tres columnas desde `md` (768): con dos, las nueve
 *   categorías necesitan cinco filas, y cinco filas no caben en una ventana
 *   baja. Entraba desde `lg` (1024), pero al bajar el mínimo de la ventana a
 *   800x600 esas cinco filas volvían a desbordar; a 800px de ancho tres
 *   columnas dan tarjetas de ~240px, que siguen siendo holgadas.
 */
export default function PantallaCuadricula({
  titulo,
  subtitulo,
  columnas = "grid-cols-1 sm:grid-cols-2 md:grid-cols-3",
  mostrarVolver = true,
  cuadriculaKey,
  children,
  tutorial,
}) {
  return (
    <div className="isolate flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-fondo text-texto">
      <PageHeader showBack={mostrarVolver} />

      {/* Sin contenedor de ancho máximo: en un monitor grande dejaba franjas
          muertas a los lados que no crecían con la ventana. */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex min-h-0 flex-1 flex-col"
        style={{
          paddingInline: "clamp(1rem, 3.5vw, 5rem)",
          // El relleno superior deja sitio al botón «Volver», que va absoluto
          // arriba a la izquierda: por debajo de 3.25rem se le echaría encima.
          paddingTop: "clamp(3.25rem, 8vh, 7rem)",
          paddingBottom: "clamp(0.75rem, 3.5vh, 3rem)",
        }}
      >
        {(titulo || subtitulo) && (
          <header style={{ marginBottom: "clamp(0.9rem, 2.4vh, 2.25rem)" }}>
            {titulo && (
              <h2
                className="font-extrabold tracking-tight text-texto"
                style={{ fontSize: "clamp(1.6rem, 3.1vw, 3.5rem)", lineHeight: 1.1 }}
              >
                {titulo}
              </h2>
            )}
            {subtitulo && (
              <p
                className="text-sutil"
                style={{ fontSize: "clamp(0.85rem, 1.05vw, 1.3rem)", marginTop: "0.35em" }}
              >
                {subtitulo}
              </p>
            )}
          </header>
        )}

        <div
          data-tutorial={cuadriculaKey}
          className={`grid min-h-0 flex-1 ${columnas}`}
          style={{
            gap: "clamp(0.6rem, 1.2vw, 1.5rem)",
            gridAutoRows: "minmax(0, 1fr)",
            // Las filas siguen repartiendose el alto, pero la tarjeta tiene
            // tope propio; centrarla deja el aire arriba y abajo en vez de
            // estirarla.
            alignItems: "center",
          }}
        >
          {children}
        </div>
      </motion.div>

      {tutorial}
    </div>
  );
}
