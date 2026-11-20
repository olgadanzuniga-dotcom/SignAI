import { useCallback, useEffect, useRef } from "react";
import useSpeech from "./useSpeech";
import { leerPrefsAudio, sonar } from "../utils/sonidos";

// Sonido de los juegos: efecto al acertar/fallar/terminar y, si está activado
// en Ajustes, la palabra leída en voz alta justo después del efecto.
export default function useAudioJuego() {
  const { speakLocal, stop } = useSpeech();
  const timeoutRef = useRef(null);

  useEffect(
    () => () => {
      clearTimeout(timeoutRef.current);
      stop();
    },
    [stop]
  );

  const decir = useCallback(
    (texto, retrasoMs = 0) => {
      if (!texto || !leerPrefsAudio().voz) return;
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => speakLocal(texto), retrasoMs);
    },
    [speakLocal]
  );

  // El efecto dura ~0.3 s; la voz entra después para no pisarlo.
  const acierto = useCallback((texto) => { sonar("acierto"); decir(texto, 350); }, [decir]);
  const error = useCallback((texto) => { sonar("error"); decir(texto, 450); }, [decir]);
  const fin = useCallback(() => sonar("fin"), []);

  return { acierto, error, fin, decir };
}
