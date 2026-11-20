// Host del servidor local de inferencia (Python). Se puede cambiar con
// VITE_SIGNAI_HOST en .env (debe coincidir con SIGNAI_PORT del servidor).
// Un solo sitio para esto: useSignServer.js y Ajustes.jsx necesitan pegarle
// al mismo motor, y tenerlo duplicado es como se desincroniza.
export const HOST = import.meta.env.VITE_SIGNAI_HOST || "127.0.0.1:8765";
export const HTTP = `http://${HOST}`;
export const WS_URL = `ws://${HOST}/ws`;
