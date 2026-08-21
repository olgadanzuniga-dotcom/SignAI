import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Sun, Moon, AudioLines, Speech, Camera, Mic2, Volume2, ChevronDown, MonitorSpeaker, Cloud, Check, Square, User, UserRound, KeyRound } from "lucide-react";
import useSpeech, { hasElevenKey } from "../../hooks/useSpeech";
import { useThemeContext } from "../../context/ThemeContext";
import Tutorial from "../common/Tutorial";
import PageLayout from "../common/PageLayout";
import ResponsiveContainer from "../common/ResponsiveContainer";
import ContentCard from "../common/ContentCard";

const AJUSTES_TUTORIAL_STEPS = [
  {
    key: "ajustes-tema",
    title: "Tema",
    text: "Aquí puedes alternar entre modo claro y modo oscuro según tu preferencia visual.",
    placement: "bottom",
  },
  {
    key: "ajustes-motor-voz",
    title: "Motor de voz",
    text: "Elige entre la voz nativa del sistema (offline) o ElevenLabs (IA en la nube con mayor calidad).",
    placement: "bottom",
  },
  {
    key: "ajustes-velocidad",
    title: "Velocidad de la voz",
    text: "Ajusta qué tan rápido o lento se reproduce la voz al traducir las señas.",
    placement: "bottom",
  },
  {
    key: "ajustes-probar",
    title: "Probar voz",
    text: "Pulsa este botón para escuchar una muestra de la voz seleccionada.",
    placement: "top",
  },
  {
    key: "ajustes-camara",
    title: "Cámara",
    text: "Selecciona qué cámara usar para captar tus señas si tienes más de una disponible.",
    placement: "top",
  },
];

const ELEVEN_VOICES = [
  { id: "6BEk9bRlUBhlAoIbhBYK", name: "Arturo", gender: "Masculina", origin: "es" },
  { id: "pBabaO9WxfrjXjKADHma", name: "Cindy", gender: "Femenina", origin: "es" },
  { id: "hrlCBOGwBPZYViXHeZjS", name: "Sofia", gender: "Femenina", origin: "es" },
  { id: "qRUgOhnxGASxirG4fKjv", name: "David", gender: "Masculina", origin: "es" },
];

function FancyDropdown({ value, options, onChange, placeholder = "Seleccionar…" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const current = options.find((o) => o.id === value) || null;
  const CurrentIcon = current?.Icon;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 pl-4 pr-10 py-2.5 rounded-lg bg-superficie-2 border border-borde text-left shadow-sm hover:border-acento focus:outline-none focus:border-acento cursor-pointer transition-all duration-300"
      >
        {CurrentIcon && (
          <span className="flex items-center justify-center w-8 h-8 rounded-md bg-acento-suave text-acento shrink-0">
            <CurrentIcon size={16} />
          </span>
        )}
        <span className="flex flex-col min-w-0 flex-1">
          <span className="font-medium text-texto truncate">
            {current?.label ?? placeholder}
          </span>
          {current?.hint && (
            <span className="text-xs text-sutil truncate">
              {current.hint}
            </span>
          )}
        </span>
        <ChevronDown
          size={18}
          className={`absolute right-3 top-1/2 -translate-y-1/2 text-acento transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <ul className="scrollbar-thin absolute z-20 mt-2 w-full max-h-72 overflow-y-auto rounded-lg border border-borde bg-superficie shadow-xl">
          {options.map(({ id, label, hint, Icon }) => {
            const active = value === id;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors duration-200 ${
                    active ? "bg-acento-suave" : "hover:bg-superficie-2"
                  }`}
                >
                  {Icon && (
                    <span
                      className={`flex items-center justify-center w-8 h-8 rounded-md shrink-0 ${
                        active
                          ? "bg-acento text-acento-texto"
                          : "bg-acento-suave text-acento"
                      }`}
                    >
                      <Icon size={16} />
                    </span>
                  )}
                  <span className="flex flex-col min-w-0 flex-1">
                    <span className="font-medium text-texto truncate">
                      {label}
                    </span>
                    {hint && (
                      <span className="text-xs text-sutil truncate">
                        {hint}
                      </span>
                    )}
                  </span>
                  {active && (
                    <Check size={16} className="text-acento shrink-0" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}


export default function Ajustes({ sidebarOpen }) {
  const { isDark, setTheme } = useThemeContext();

  const { voices, settings, update, speak, stop, speaking } = useSpeech();
  const elevenKeyMissing = settings.provider === "elevenlabs" && !hasElevenKey(settings);

  const PROVIDER_OPTIONS = [
    { id: "webspeech", label: "Web Speech", hint: "Nativa del sistema · offline", Icon: MonitorSpeaker },
    { id: "elevenlabs", label: "ElevenLabs", hint: "IA en la nube · alta calidad", Icon: Cloud },
  ];

  const ELEVEN_OPTIONS = ELEVEN_VOICES.map((v) => ({
    id: v.id,
    label: v.name,
    hint: v.gender,
    Icon: v.gender === "Femenina" ? UserRound : User,
  }));

  const [camaras, setCamaras] = useState([]);
  const [camaraSeleccionada, setCamaraSeleccionada] = useState(
    localStorage.getItem("camara_lsm") || ""
  );

  useEffect(() => {
    async function obtenerCamaras() {
      try {
        const dispositivos = await navigator.mediaDevices.enumerateDevices();
        setCamaras(dispositivos.filter((d) => d.kind === "videoinput"));
      } catch (err) {
        console.error("Error al listar cámaras:", err);
      }
    }
    obtenerCamaras();
  }, []);

  const cambiarCamara = (id) => {
    setCamaraSeleccionada(id);
    localStorage.setItem("camara_lsm", id);
  };

  const vocesEs = voices.filter((v) => v.lang.toLowerCase().startsWith("es"));

  return (
    <PageLayout contentClassName="items-center justify-center min-h-screen py-6 sm:py-10 2xl:py-14 text-texto transition-all duration-700 ease-in-out">

      <ResponsiveContainer
        size={sidebarOpen ? "md" : "lg"}
        className={`transition-all duration-700 ease-in-out ${
          sidebarOpen ? "scale-[0.98]" : "scale-100"
        }`}
      >
        <h2 className="text-2xl sm:text-3xl 2xl:text-4xl font-extrabold mb-6 sm:mb-8 2xl:mb-10 text-center">Ajustes</h2>

        <ContentCard as="section" data-tutorial="ajustes-tema" className="mb-4 sm:mb-6 2xl:mb-8 transition-all duration-700">
          <h3 className="text-base sm:text-lg 2xl:text-xl font-semibold flex items-center gap-2 mb-3 sm:mb-4">
            <Sun className="text-acento" /> Tema
          </h3>

          <div className="flex gap-3 sm:gap-4 justify-start flex-wrap">
            <button
              onClick={() => setTheme("light")}
              className={`flex items-center gap-2 px-3 sm:px-4 2xl:px-5 py-1.5 sm:py-2 2xl:py-2.5 rounded-lg text-sm sm:text-base 2xl:text-lg transition-all duration-300 ${
                !isDark
                  ? "bg-acento-suave text-acento font-medium shadow-sm"
                  : "bg-transparent text-sutil hover:bg-superficie-2"
              }`}
            >
              <Sun size={18} /> Modo claro
            </button>

            <button
              onClick={() => setTheme("dark")}
              className={`flex items-center gap-2 px-3 sm:px-4 2xl:px-5 py-1.5 sm:py-2 2xl:py-2.5 rounded-lg text-sm sm:text-base 2xl:text-lg transition-all duration-300 ${
                isDark
                  ? "bg-acento-suave text-acento font-medium shadow-sm"
                  : "bg-transparent text-sutil hover:bg-superficie-2"
              }`}
            >
              <Moon size={18} /> Modo oscuro
            </button>
          </div>
        </ContentCard>

        <ContentCard as="section" data-tutorial="ajustes-motor-voz" className="mb-4 sm:mb-6 2xl:mb-8 transition-all duration-700">
          <h3 className="text-base sm:text-lg 2xl:text-xl font-semibold flex items-center gap-2 mb-3">
            <Mic2 className="text-acento" />
            Motor de voz
          </h3>
          <FancyDropdown
            value={settings.provider}
            options={PROVIDER_OPTIONS}
            onChange={(id) => update({ provider: id })}
          />
          <p className="text-xs 2xl:text-sm text-sutil mt-2">
            Web Speech funciona offline y usa las voces instaladas en tu sistema. ElevenLabs usa voces de IA en la nube con mayor calidad.
          </p>
        </ContentCard>

        {settings.provider === "elevenlabs" && (
          <ContentCard as="section" className="mb-4 sm:mb-6 2xl:mb-8 transition-all duration-700">
            <h3 className="text-base sm:text-lg 2xl:text-xl font-semibold flex items-center gap-2 mb-3">
              <KeyRound className="text-acento" />
              API key de ElevenLabs
            </h3>
            <input
              type="password"
              value={settings.elevenApiKey}
              onChange={(e) => update({ elevenApiKey: e.target.value.trim() })}
              placeholder="sk_..."
              aria-label="API key de ElevenLabs"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl border border-borde bg-superficie-2 px-3 py-2 text-sm 2xl:text-base font-mono text-texto focus:outline-none focus:border-acento"
            />
            <p className="text-xs 2xl:text-sm text-sutil mt-2">
              ElevenLabs es un servicio de pago con cuenta propia. Crea tu key en
              elevenlabs.io y pégala aquí: se guarda solo en este equipo y no
              se comparte. Sin key, SignAI usa Web Speech.
            </p>
            {elevenKeyMissing && (
              <p className="mt-3 flex items-start gap-2 rounded-xl border border-aviso/40 bg-aviso/10 px-3 py-2 text-sm 2xl:text-base text-aviso">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Falta la API key: mientras tanto se usará la voz del sistema.</span>
              </p>
            )}
          </ContentCard>
        )}

        <ContentCard as="section" data-tutorial="ajustes-velocidad" className="mb-4 sm:mb-6 2xl:mb-8 transition-all duration-700">
          <h3 className="text-base sm:text-lg 2xl:text-xl font-semibold flex items-center gap-2 mb-3">
            <AudioLines className="text-acento" />
            Velocidad de la voz
          </h3>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={settings.rate}
            onChange={(e) => update({ rate: parseFloat(e.target.value) })}
            aria-label="Velocidad de la voz"
            aria-valuetext={`${settings.rate.toFixed(1)} veces`}
            className="w-full"
          />
          <p className="text-center mt-2 text-sm 2xl:text-base text-sutil">
            {settings.rate.toFixed(1)}x
          </p>
        </ContentCard>

        {settings.provider === "webspeech" && (
          <ContentCard as="section" className="mb-4 sm:mb-6 2xl:mb-8 transition-all duration-700">
            <h3 className="text-base sm:text-lg 2xl:text-xl font-semibold flex items-center gap-2 mb-3">
              <Volume2 className="text-acento" />
              Tipo de voz
            </h3>
            {vocesEs.length > 0 ? (
              <FancyDropdown
                value={settings.voiceURI || ""}
                onChange={(id) => update({ voiceURI: id })}
                options={[
                  { id: "", label: "Automática", hint: "Elegir según el sistema", Icon: Volume2 },
                  ...vocesEs.map((v) => ({
                    id: v.voiceURI,
                    label: v.name,
                    hint: v.lang,
                    Icon: Speech,
                  })),
                ]}
              />
            ) : (
              <p className="text-sm 2xl:text-base text-sutil">
                Cargando voces disponibles…
              </p>
            )}
          </ContentCard>
        )}

        {settings.provider === "elevenlabs" && (
          <ContentCard as="section" className="mb-4 sm:mb-6 2xl:mb-8 transition-all duration-700">
            <h3 className="text-base sm:text-lg 2xl:text-xl font-semibold flex items-center gap-2 mb-3">
              <Speech className="text-acento" />
              Tipo de voz
            </h3>
            <FancyDropdown
              value={settings.elevenVoiceId}
              options={ELEVEN_OPTIONS}
              onChange={(id) => update({ elevenVoiceId: id, elevenModel: "eleven_multilingual_v2" })}
            />
          </ContentCard>
        )}

        <ContentCard as="section" data-tutorial="ajustes-probar" className="mb-4 sm:mb-6 2xl:mb-8 transition-all duration-700 flex justify-center">
          <button
            onClick={() =>
              speaking ? stop() : speak("Hola, soy SignAI. Esta es tu voz seleccionada.")
            }
            className={`inline-flex items-center gap-2 px-5 sm:px-6 2xl:px-8 py-2 sm:py-2.5 2xl:py-3 rounded-xl font-semibold text-sm sm:text-base 2xl:text-lg shadow-lg transition-all active:scale-95 text-acento-texto ${
              speaking ? "bg-error animate-pulse" : "bg-acento hover:bg-acento-fuerte"
            }`}
          >
            {speaking ? (
              <>
                <Square className="w-4 h-4" fill="currentColor" />
                Detener
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4" />
                Probar voz
              </>
            )}
          </button>
        </ContentCard>

        <ContentCard as="section" data-tutorial="ajustes-camara" className="transition-all duration-700">
          <h3 className="text-base sm:text-lg 2xl:text-xl font-semibold flex items-center gap-2 mb-3">
            <Camera className="text-acento" />
            Cámara
          </h3>
          {camaras.length > 0 ? (
            <FancyDropdown
              value={camaraSeleccionada || camaras[0]?.deviceId || ""}
              onChange={(id) => cambiarCamara(id)}
              options={camaras.map((cam, i) => ({
                id: cam.deviceId,
                label: cam.label || `Cámara ${i + 1}`,
                hint: cam.label ? "Dispositivo detectado" : "Sin nombre · permisos limitados",
                Icon: Camera,
              }))}
            />
          ) : (
            <p className="text-sm 2xl:text-base text-sutil">
              No se detectaron cámaras o no se otorgaron permisos.
            </p>
          )}
        </ContentCard>
      </ResponsiveContainer>

      <Tutorial
        steps={AJUSTES_TUTORIAL_STEPS}
        storageKey="tourSignAI_ajustes"
      />
    </PageLayout>
  );
}
