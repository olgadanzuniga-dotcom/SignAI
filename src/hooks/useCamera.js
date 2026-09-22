import { useCallback, useEffect, useRef, useState } from "react";
import { leer } from "../utils/almacen";

export default function useCamera({ autoStart = false, constraintsList } = {}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const defaultList = [
    { video: true },
    { video: { facingMode: "user" } },
    { video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } },
    { video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: "user" } },
  ];

  const conDispositivo = (c, id) => {
    if (c.video === true) return { video: { deviceId: { exact: id } } };
    return { ...c, video: { ...c.video, deviceId: { exact: id } } };
  };

  const stop = useCallback(() => {
    const s = streamRef.current;
    if (s) s.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, []);

  const start = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    stop();

    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg("Tu navegador no soporta acceso a cámara (getUserMedia).");
      setLoading(false);
      return false;
    }

    const base = constraintsList || defaultList;
    const guardada = leer("camara_lsm");

    // Primero la cámara elegida en Ajustes; si ya no está conectada (portátil
    // que perdió la webcam USB, o un `deviceId` de otra sesión), los mismos
    // intentos SIN fijarla. Antes el `deviceId: { exact }` se le pegaba a las
    // cuatro combinaciones, así que las cuatro fallaban con
    // `OverconstrainedError` — que además es el único error que no producía
    // mensaje. Resultado: pulsar «Iniciar cámara» no hacía absolutamente
    // nada, sin imagen y sin explicación.
    const intentos = guardada
      ? [...base.map((c) => conDispositivo(c, guardada)), ...base]
      : base;

    let ultimoFallo = null;
    for (const c of intentos) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(c);
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setActive(true);
        setLoading(false);
        return true;
      } catch (err) {
        ultimoFallo = err;
        // Permiso denegado no se arregla probando otra resolución: si se
        // siguiera intentando, Windows enseñaría el aviso una vez por intento.
        if (err?.name === "NotAllowedError") {
          setErrorMsg("Acceso denegado. Permite el uso de la cámara en tu navegador.");
          setLoading(false);
          return false;
        }
        if (err?.name === "NotFoundError") {
          setErrorMsg("No se encontró cámara. Verifica que esté conectada.");
        } else if (err?.name !== "OverconstrainedError") {
          setErrorMsg("No se pudo acceder a la cámara. Verifica permisos.");
        }
      }
    }

    // Ningún intento funcionó: siempre hay que decir algo, aunque el último
    // error fuese `OverconstrainedError`.
    setErrorMsg((previo) =>
      previo ||
      (ultimoFallo?.name === "NotReadableError"
        ? "Otra aplicación está usando la cámara. Cierra Zoom, Teams o Meet e inténtalo otra vez."
        : "No se pudo abrir ninguna cámara. Revisa que esté conectada y que ningún otro programa la esté usando.")
    );
    setLoading(false);
    return false;
  }, [constraintsList, stop]);

  useEffect(() => {
    if (autoStart) start();
    return () => stop();
  }, [autoStart, start, stop]);

  // Reasocia el stream al <video> en cuanto el elemento aparece en el DOM.
  // Necesario cuando el <video> se renderiza condicionalmente sobre `active`,
  // porque entonces videoRef.current es null al momento de llamar a start().
  useEffect(() => {
    if (active && videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [active]);

  return { videoRef, active, loading, errorMsg, start, stop, setErrorMsg };
}
