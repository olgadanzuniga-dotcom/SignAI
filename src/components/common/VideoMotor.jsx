import React, { forwardRef, useEffect, useRef } from "react";

// GIF transparente de 1x1: sustituir el src por algo que no es del motor es lo
// que obliga a Chromium a cancelar la descarga del MJPEG.
const VACIO = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

/**
 * <img> para el stream MJPEG del motor (/video).
 *
 * Quitar un <img> del DOM NO corta su descarga en Chromium: el stream seguia
 * vivo en segundo plano. Cada vez que se abria y cerraba el traductor quedaba
 * una conexion colgada (el motor contaba un consumidor mas y no soltaba la
 * camara) y a la sexta se agotaba el limite de 6 conexiones por servidor: el
 * video ya no cargaba y la app se trababa (medido 2026-11-12). Al desmontar o
 * al cambiar de URL se cambia el src a mano para cerrar la conexion.
 */
const VideoMotor = forwardRef(function VideoMotor({ src, ...props }, refExterno) {
  const ref = useRef(null);

  // Solo al desmontar: si cambia la URL, React pone el src nuevo y eso ya
  // cancela la descarga vieja (una limpieza aqui pisaria el src nuevo, porque
  // los efectos corren despues de actualizar el DOM).
  useEffect(() => {
    const img = ref.current;
    return () => {
      if (img) {
        img.src = VACIO;
        img.removeAttribute("src");
      }
    };
  }, []);

  const setRef = (el) => {
    ref.current = el;
    if (typeof refExterno === "function") refExterno(el);
    else if (refExterno) refExterno.current = el;
  };

  return <img ref={setRef} src={src} {...props} />;
});

export default VideoMotor;
