import { useCallback, useEffect, useRef, useState } from "react";
import { guardarJSON, leerJSON } from "../utils/almacen";

const STORAGE_KEY = "signai_voice_settings";

const defaults = {
  provider: "webspeech",
  rate: 1,
  pitch: 1,
  volume: 1,
  lang: "es-MX",
  voiceURI: "",
  elevenVoiceId: "EXAVITQu4vr4xnSDxMaL",
  elevenModel: "eleven_multilingual_v2",
  elevenStability: 0.5,
  elevenSimilarity: 0.75,
  elevenStyle: 0,
  elevenSpeakerBoost: true,
  // La key de ElevenLabs la escribe cada usuario en Ajustes y vive en
  // localStorage. A proposito NO se lee de import.meta.env: Vite sustituye
  // esas variables por su valor literal al compilar, asi que una key de
  // build quedaria en texto plano dentro del .exe que se reparte.
  elevenApiKey: "",
};

export const hasElevenKey = (settings) =>
  Boolean((settings || loadVoiceSettings()).elevenApiKey);

export function loadVoiceSettings() {
  return { ...defaults, ...(leerJSON(STORAGE_KEY, null) || {}) };
}

export function saveVoiceSettings(s) {
  guardarJSON(STORAGE_KEY, s);
}

export default function useSpeech() {
  const [voices, setVoices] = useState([]);
  const [settings, setSettings] = useState(loadVoiceSettings);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const update = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveVoiceSettings(next);
      return next;
    });
  }, []);

  const pickWebVoice = useCallback(() => {
    if (!voices.length) return null;
    if (settings.voiceURI) {
      const exact = voices.find((v) => v.voiceURI === settings.voiceURI);
      if (exact) return exact;
    }
    const esVoices = voices.filter((v) => v.lang.toLowerCase().startsWith("es"));
    return (esVoices.length ? esVoices : voices)[0];
  }, [voices, settings]);

  const stop = useCallback(() => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setSpeaking(false);
  }, []);

  const speakWeb = useCallback(
    (text) => {
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = settings.rate;
      u.pitch = settings.pitch;
      u.volume = settings.volume;
      u.lang = settings.lang;
      const v = pickWebVoice();
      if (v) u.voice = v;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
    },
    [settings, pickWebVoice]
  );

  const speakEleven = useCallback(
    async (text) => {
      const apiKey = settings.elevenApiKey;
      if (!apiKey) {
        console.warn("ElevenLabs: falta la API key (se configura en Ajustes).");
        return false;
      }
      try {
        setSpeaking(true);
        const res = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${settings.elevenVoiceId}`,
          {
            method: "POST",
            headers: {
              "xi-api-key": apiKey,
              "Content-Type": "application/json",
              Accept: "audio/mpeg",
            },
            body: JSON.stringify({
              text,
              model_id: settings.elevenModel,
              voice_settings: {
                stability: settings.elevenStability,
                similarity_boost: settings.elevenSimilarity,
                style: settings.elevenStyle,
                use_speaker_boost: settings.elevenSpeakerBoost,
                speed: settings.rate,
              },
            }),
          }
        );
        if (!res.ok) {
          console.error("ElevenLabs error:", res.status, await res.text());
          setSpeaking(false);
          return false;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.volume = settings.volume;
        audio.onended = () => {
          setSpeaking(false);
          URL.revokeObjectURL(url);
        };
        audio.onerror = () => {
          setSpeaking(false);
          URL.revokeObjectURL(url);
        };
        audioRef.current = audio;
        await audio.play();
        return true;
      } catch (err) {
        console.error("ElevenLabs request failed:", err);
        setSpeaking(false);
        return false;
      }
    },
    [settings]
  );

  const speak = useCallback(
    async (text) => {
      if (!text) return;
      stop();
      if (settings.provider === "elevenlabs") {
        const ok = await speakEleven(text);
        if (ok) return;
        // Sin key, sin internet o con la cuenta agotada: mejor la voz del
        // sistema que el silencio.
      }
      return speakWeb(text);
    },
    [settings.provider, speakWeb, speakEleven, stop]
  );

  return { voices, settings, update, speak, stop, speaking };
}
