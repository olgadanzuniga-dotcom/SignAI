import { useCallback, useEffect, useRef, useState } from "react";

// Servidor local de inferencia (Python). El mismo proceso sirve el video
// MJPEG y los eventos por WebSocket. El host se puede cambiar con
// VITE_SIGNAI_HOST en .env (debe coincidir con SIGNAI_PORT del servidor).
const HOST = import.meta.env.VITE_SIGNAI_HOST || "127.0.0.1:8765";
const HTTP = `http://${HOST}`;
const WS_URL = `ws://${HOST}/ws`;

// Reintentos de conexión: backoff exponencial 1s → 8s. Tras DOWN_AFTER_ATTEMPTS
// intentos fallidos seguidos se expone `serverDown` para que la UI avise al
// usuario (los reintentos continúan en segundo plano).
const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 8000;
const DOWN_AFTER_ATTEMPTS = 6;

// Pide al servidor que active un modelo. El servidor confirma después por WS
// con un evento {tipo:"modelo"} dirigido a todos los clientes.
function pedirModeloAlServidor(key) {
  return fetch(`${HTTP}/modelo?modelo=${encodeURIComponent(key)}`, {
    method: "POST",
  }).catch((err) => {
    console.warn("No se pudo cambiar el modelo en el servidor:", err);
  });
}

/**
 * Conecta con el servidor de señas mientras el componente esté montado.
 *
 * - `videoUrl`: URL del stream MJPEG para un <img>. Al desmontar se vacía,
 *   lo que detiene el <img> y libera la cámara en el servidor (junto con el
 *   cierre del WebSocket). Así otras pantallas pueden usar getUserMedia.
 * - `status`: estado en vivo { estado, letra, conf, top3, hand, buffer }.
 * - `lastCommit`: última seña confirmada { letra, conf, id }. El `id` cambia
 *   en cada commit nuevo (útil como dependencia de efectos).
 * - `onCommit`: callback opcional que se llama en cada commit.
 * - `serverDown`: true cuando llevamos varios intentos sin poder conectar.
 * - `engineError`: mensaje del servidor cuando el motor esta conectado
 *   pero no puede trabajar (tipicamente: no pudo abrir la camara).
 *
 * El modelo activo es GLOBAL del servidor: si otra pantalla lo cambió, esta lo
 * heredaría. `modeloPreferido` (uno o varios, por orden de preferencia) pide el
 * primero que exista, una sola vez por conexión, para que cada pantalla arranque
 * con el modelo que sabe interpretar sin bloquear el selector manual.
 *
 * @param {{ enabled?: boolean, modeloPreferido?: string|string[], onCommit?: (c:{letra:string,conf:number,id:number})=>void }} opts
 */
export default function useSignServer({
  enabled = true,
  modeloPreferido,
  onCommit,
} = {}) {
  const [connected, setConnected] = useState(false);
  const [serverDown, setServerDown] = useState(false);
  const [engineError, setEngineError] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [status, setStatus] = useState({
    estado: "IDLE",
    letra: "",
    conf: 0,
    top3: null,
    hand: false,
    buffer: 0,
  });
  const [lastCommit, setLastCommit] = useState(null);
  // Modelos disponibles en el servidor y cual esta activo (para el selector).
  const [modelos, setModelos] = useState([]);
  const [modelo, setModeloActual] = useState(null);

  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  const commitSeq = useRef(0);

  // Lista estable de preferencias (acepta string o array) para no re-disparar
  // el efecto por una identidad de array nueva en cada render.
  const preferidos = Array.isArray(modeloPreferido)
    ? modeloPreferido.join("|")
    : modeloPreferido || "";
  const preferidosRef = useRef(preferidos);
  preferidosRef.current = preferidos;

  useEffect(() => {
    if (!enabled) {
      setVideoUrl("");
      return;
    }

    let stopped = false;
    let ws = null;
    let reconnectTimer = null;
    let intentosFallidos = 0;
    let preferenciaAplicada = false;

    // Reintento con el mismo backoff que usa `onclose`. Se saca aparte porque
    // ahora hay dos sitios que pueden fallar: el cierre y el propio
    // constructor.
    const reintentar = () => {
      if (stopped) return;
      intentosFallidos += 1;
      if (intentosFallidos >= DOWN_AFTER_ATTEMPTS) setServerDown(true);
      const delay = Math.min(
        RETRY_BASE_MS * 2 ** (intentosFallidos - 1),
        RETRY_MAX_MS
      );
      reconnectTimer = setTimeout(connect, delay);
    };

    const connect = () => {
      if (stopped) return;
      try {
        ws = new WebSocket(WS_URL);
      } catch (err) {
        // `new WebSocket` lanza de forma SÍNCRONA si la URL no es válida —
        // p. ej. con un VITE_SIGNAI_HOST mal escrito en el .env. Al pasar
        // dentro de un efecto, la excepción subía y se llevaba por delante
        // la pantalla entera en vez de mostrar «no se pudo conectar».
        console.error("No se pudo abrir el WebSocket del motor:", err);
        setEngineError(
          "La dirección del motor de traducción no es válida (VITE_SIGNAI_HOST)."
        );
        reintentar();
        return;
      }

      ws.onopen = () => {
        intentosFallidos = 0;
        setServerDown(false);
        setConnected(true);
        setEngineError("");
        // El servidor ya responde: ahora sí pedimos el stream MJPEG.
        // El cache-bust fuerza un <img> nuevo (consumidor nuevo) en cada
        // (re)conexión, evitando que quede pegado a un intento fallido.
        setVideoUrl(`${HTTP}/video?t=${Date.now()}`);
      };

      ws.onclose = () => {
        setConnected(false);
        setVideoUrl(""); // el stream también murió; se repide al reconectar
        reintentar();
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {}
      };

      ws.onmessage = (e) => {
        let msg;
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }
        if (msg.tipo === "hello") {
          if (Array.isArray(msg.modelos)) setModelos(msg.modelos);
          if (msg.modelo) setModeloActual(msg.modelo);

          // Una sola vez por conexión: si esta pantalla declaró un modelo
          // preferido y el servidor está en otro (porque otra pantalla lo
          // cambió), lo pedimos. Después el selector manual manda.
          if (!preferenciaAplicada && preferidosRef.current) {
            preferenciaAplicada = true;
            const disponibles = Array.isArray(msg.modelos) ? msg.modelos : [];
            const elegido = preferidosRef.current
              .split("|")
              .find((k) => disponibles.includes(k));
            if (elegido && elegido !== msg.modelo) {
              setModeloActual(elegido);
              pedirModeloAlServidor(elegido);
            }
          }
        } else if (msg.tipo === "modelo") {
          // El servidor confirma el cambio de modelo (a todos los clientes).
          if (msg.actual) setModeloActual(msg.actual);
        } else if (msg.tipo === "error") {
          setEngineError(msg.msg || "El motor de traduccion reporto un error.");
        } else if (msg.tipo === "status") {
          // Si llegan frames, lo que fallaba ya se resolvio.
          setEngineError("");
          setStatus({
            estado: msg.estado,
            letra: msg.letra || "",
            conf: msg.conf || 0,
            top3: msg.top3 || null,
            hand: !!msg.hand,
            buffer: msg.buffer || 0,
          });
        } else if (msg.tipo === "commit") {
          const c = { letra: msg.letra, conf: msg.conf, id: ++commitSeq.current };
          setLastCommit(c);
          onCommitRef.current?.(c);
        }
      };
    };

    connect();

    return () => {
      stopped = true;
      clearTimeout(reconnectTimer);
      try {
        ws?.close();
      } catch {}
      setConnected(false);
      setServerDown(false);
      setEngineError("");
      setVideoUrl(""); // detiene el <img> -> libera la cámara del servidor
    };
  }, [enabled]);

  // Cambia el modelo activo en el servidor. Actualiza el estado de forma
  // optimista; el servidor confirma luego con un evento "modelo" por WS.
  const setModelo = useCallback((key) => {
    if (!key) return;
    setModeloActual(key);
    pedirModeloAlServidor(key);
  }, []);

  return {
    connected,
    serverDown,
    engineError,
    videoUrl,
    status,
    lastCommit,
    modelos,
    modelo,
    setModelo,
  };
}
