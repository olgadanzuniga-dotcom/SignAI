import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Sun, Moon, AudioLines, Speech, Camera, Mic2, Volume2, ChevronDown, MonitorSpeaker, Cloud, Check, Square, User, UserRound, KeyRound, Gamepad2 } from "lucide-react";
import useSpeech, { hasElevenKey } from "../../hooks/useSpeech";
import { useThemeContext } from "../../context/ThemeContext";
import Tutorial from "../common/Tutorial";
import PageLayout from "../common/PageLayout";
import ResponsiveContainer from "../common/ResponsiveContainer";
import ContentCard from "../common/ContentCard";
import { guardar, leer } from "../../utils/almacen";
import { HTTP } from "../../utils/signServer";
import { leerPrefsAudio, guardarPrefsAudio, sonar } from "../../utils/sonidos";
import { usePerfil, borrarPerfil, guardarPerfil } from "../../utils/perfil";
import { useIdioma, IDIOMAS, tr } from "../../i18n";
import NombreEnSenas from "../common/NombreEnSenas";
import { Languages } from "lucide-react";
import { FirmaAnimada } from "../common/Firma";
import { PenLine } from "lucide-react";

// Interruptor de encendido/apagado accesible.
function Interruptor({ activo, onCambio, etiqueta, descripcion }) {
  const { t } = useIdioma();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      onClick={() => onCambio(!activo)}
      className="w-full flex items-center justify-between gap-4 py-2 text-left"
    >
      <span>
        <span className="block text-sm sm:text-base 2xl:text-lg font-medium text-texto">{t(etiqueta)}</span>
        <span className="block text-xs sm:text-sm text-sutil">{t(descripcion)}</span>
      </span>
      <span
        className={`relative shrink-0 w-12 h-7 rounded-full transition-colors duration-300 ${
          activo ? "bg-acento" : "bg-superficie-2 border border-borde"
        }`}
      >
        <span
          className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all duration-300 ${
            activo ? "left-6" : "left-1"
          }`}
        />
      </span>
    </button>
  );
}

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
  const { t } = useIdioma();
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
            {t(current?.label ?? placeholder)}
          </span>
          {current?.hint && (
            <span className="text-xs text-sutil truncate">
              {t(current.hint)}
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
                      {t(label)}
                    </span>
                    {hint && (
                      <span className="text-xs text-sutil truncate">
                        {t(hint)}
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
  const perfil = usePerfil();
  const { isDark, setTheme } = useThemeContext();
  const { t, idioma, setIdioma, en } = useIdioma();
  const [nombreEdit, setNombreEdit] = useState(perfil?.nombre || "");
  useEffect(() => setNombreEdit(perfil?.nombre || ""), [perfil?.nombre]);
  const guardarNombre = () => {
    const n = nombreEdit.trim().slice(0, 30);
    if (n === (perfil?.nombre || "")) return;
    guardarPerfil({ ...(perfil || { trazos: [], tinta: "marca" }), nombre: n, omitido: false });
  };

  const { voices, settings, update, speak, stop, speaking } = useSpeech();
  const elevenKeyMissing = settings.provider === "elevenlabs" && !hasElevenKey(settings);

  const [audioJuegos, setAudioJuegos] = useState(leerPrefsAudio);
  const cambiarAudioJuegos = (patch) => {
    const nuevo = { ...audioJuegos, ...patch };
    setAudioJuegos(nuevo);
    guardarPrefsAudio(nuevo);
    if (patch.efectos) sonar("acierto"); // muestra cómo suena al encenderlo
  };

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

  // El motor (Python) abre la cámara por su cuenta con OpenCV: lo que ve
  // `navigator.mediaDevices` del navegador es una lista aparte que no tiene
  // por qué coincidir en índice ni en orden, así que elegir ahí no cambiaba
  // nada de lo que el traductor realmente usaba (siempre el índice 0, la
  // integrada). Aquí se pide la lista del propio motor y se le avisa a él.
  const [camaras, setCamaras] = useState([]);
  const [camaraSeleccionada, setCamaraSeleccionada] = useState(null);
  const [cargandoCamaras, setCargandoCamaras] = useState(true);

  // La preferencia guardada (o, la primera vez, la cámara externa) ya se le
  // aplica al motor apenas arranca la app (ver useAutoCamara en App.jsx);
  // aquí solo se refleja qué quedó activo y se deja elegir otra a mano.
  useEffect(() => {
    let cancelado = false;
    async function obtenerCamaras() {
      try {
        const r = await fetch(`${HTTP}/camaras`);
        const data = await r.json();
        if (cancelado) return;
        setCamaras(Array.isArray(data.camaras) ? data.camaras : []);
        setCamaraSeleccionada(data.actual ?? 0);
      } catch (err) {
        console.error("Error al listar cámaras:", err);
      } finally {
        if (!cancelado) setCargandoCamaras(false);
      }
    }
    obtenerCamaras();
    return () => {
      cancelado = true;
    };
  }, []);

  const cambiarCamara = async (indice) => {
    const anterior = camaraSeleccionada;
    setCamaraSeleccionada(indice); // optimista: se revierte abajo si falla
    try {
      const r = await fetch(`${HTTP}/camara?indice=${indice}`, { method: "POST" });
      if (!r.ok) throw new Error(`servidor respondió ${r.status}`);
      guardar("camara_lsm", String(indice));
    } catch (err) {
      console.warn("No se pudo cambiar la cámara en el servidor:", err);
      setCamaraSeleccionada(anterior);
    }
  };

  const vocesEs = voices.filter((v) => v.lang.toLowerCase().startsWith(en ? "en" : "es"));
  const claveVoz = en ? "voiceURIEn" : "voiceURI";

  return (
    // Sin `min-h-screen`: el <main> ya mide justo la ventana, así que pedir
    // 100vh dentro del marco (que tiene relleno propio) sacaba barra de
    // desplazamiento incluso en un monitor donde Ajustes cabía entero.
    <PageLayout
      contentClassName="items-center justify-center text-texto transition-all duration-700 ease-in-out"
      contentStyle={{ paddingBlock: "clamp(1rem, 3vh, 3.5rem)" }}
    >

      <ResponsiveContainer
        size={sidebarOpen ? "md" : "lg"}
        className={`transition-all duration-700 ease-in-out ${
          sidebarOpen ? "scale-[0.98]" : "scale-100"
        }`}
      >
        <h2 className="text-2xl sm:text-3xl 2xl:text-4xl font-extrabold mb-6 sm:mb-8 2xl:mb-10 text-center">{t("Ajustes")}</h2>

        <ContentCard as="section" className="mb-4 sm:mb-6 2xl:mb-8 transition-all duration-700">
          <h3 className="text-base sm:text-lg 2xl:text-xl font-semibold flex items-center gap-2 mb-3 sm:mb-4">
            <Languages className="text-acento" /> {en ? "Language" : "Idioma · Language"}</h3>
          <div className="flex gap-3 sm:gap-4 justify-start flex-wrap">
            {IDIOMAS.map((i) => (
              <button
                key={i.id}
                onClick={() => setIdioma(i.id)}
                className={`flex items-center gap-2 px-3 sm:px-4 2xl:px-5 py-1.5 sm:py-2 2xl:py-2.5 rounded-lg text-sm sm:text-base 2xl:text-lg transition-all duration-300 ${
                  idioma === i.id
                    ? "bg-acento-suave text-acento font-medium shadow-sm"
                    : "bg-transparent text-sutil hover:bg-superficie-2"
                }`}
              >
                {i.nombre}
              </button>
            ))}
          </div>
          <p className="text-xs 2xl:text-sm text-sutil mt-2">
            {t("Cambia los textos y la voz de la app. Las señas siguen siendo de Lengua de Señas Mexicana.")}
          </p>
        </ContentCard>

        <ContentCard as="section" className="mb-4 sm:mb-6 2xl:mb-8 transition-all duration-700">
          <h3 className="text-base sm:text-lg 2xl:text-xl font-semibold flex items-center gap-2 mb-3 sm:mb-4">
            <UserRound className="text-acento" /> {t("Mi perfil")}
          </h3>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 flex items-center gap-4">
              {perfil?.trazos?.length ? (
                <FirmaAnimada
                  trazos={perfil.trazos}
                  tintaId={perfil.tinta}
                  duracion={1.2}
                  style={{ height: "3.5rem", maxWidth: "16rem" }}
                />
              ) : (
                <span className="text-sutil text-sm">{t("Aún no has dibujado tu firma.")}</span>
              )}
            </div>
            <button
              onClick={borrarPerfil}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm sm:text-base bg-acento-suave text-acento font-medium hover:brightness-95 transition"
            >
              <PenLine size={18} /> {perfil?.trazos?.length ? t("Volver a escribir mi nombre") : t("Escribir mi nombre")}
            </button>
          </div>
          <label className="mt-4 flex flex-col gap-1">
            <span className="text-sm text-sutil">{t("Tu nombre (para saludarte y verlo en señas)")}</span>
            <input
              value={nombreEdit}
              onChange={(e) => setNombreEdit(e.target.value.slice(0, 30))}
              onBlur={guardarNombre}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              placeholder={t("Tu nombre")}
              className="w-full max-w-sm rounded-xl border border-borde bg-superficie-2 px-4 py-2 text-base text-texto focus:outline-none focus:border-acento"
            />
          </label>
          {nombreEdit.trim() && (
            <div className="mt-3">
              <NombreEnSenas nombre={nombreEdit} tamano="chico" />
            </div>
          )}
        </ContentCard>

        <ContentCard as="section" data-tutorial="ajustes-tema" className="mb-4 sm:mb-6 2xl:mb-8 transition-all duration-700">
          <h3 className="text-base sm:text-lg 2xl:text-xl font-semibold flex items-center gap-2 mb-3 sm:mb-4">
            <Sun className="text-acento" /> {t("Tema")}
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
              <Sun size={18} /> {t("Modo claro")}
            </button>

            <button
              onClick={() => setTheme("dark")}
              className={`flex items-center gap-2 px-3 sm:px-4 2xl:px-5 py-1.5 sm:py-2 2xl:py-2.5 rounded-lg text-sm sm:text-base 2xl:text-lg transition-all duration-300 ${
                isDark
                  ? "bg-acento-suave text-acento font-medium shadow-sm"
                  : "bg-transparent text-sutil hover:bg-superficie-2"
              }`}
            >
              <Moon size={18} /> {t("Modo oscuro")}
            </button>
          </div>
        </ContentCard>

        <ContentCard as="section" data-tutorial="ajustes-motor-voz" className="mb-4 sm:mb-6 2xl:mb-8 transition-all duration-700">
          <h3 className="text-base sm:text-lg 2xl:text-xl font-semibold flex items-center gap-2 mb-3">
            <Mic2 className="text-acento" />
            {t("Motor de voz")}
          </h3>
          <FancyDropdown
            value={settings.provider}
            options={PROVIDER_OPTIONS}
            onChange={(id) => update({ provider: id })}
          />
          <p className="text-xs 2xl:text-sm text-sutil mt-2">
            {t("Web Speech funciona offline y usa las voces instaladas en tu sistema. ElevenLabs usa voces de IA en la nube con mayor calidad.")}
          </p>
        </ContentCard>

        {settings.provider === "elevenlabs" && (
          <ContentCard as="section" className="mb-4 sm:mb-6 2xl:mb-8 transition-all duration-700">
            <h3 className="text-base sm:text-lg 2xl:text-xl font-semibold flex items-center gap-2 mb-3">
              <KeyRound className="text-acento" />
              {t("API key de ElevenLabs")}
            </h3>
            <input
              type="password"
              value={settings.elevenApiKey}
              onChange={(e) => update({ elevenApiKey: e.target.value.trim() })}
              placeholder={tr("sk_...")}
              aria-label={t("API key de ElevenLabs")}
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl border border-borde bg-superficie-2 px-3 py-2 text-sm 2xl:text-base font-mono text-texto focus:outline-none focus:border-acento"
            />
            <p className="text-xs 2xl:text-sm text-sutil mt-2">
              {t("ElevenLabs es un servicio de pago con cuenta propia. Crea tu key en elevenlabs.io y pégala aquí: se guarda solo en este equipo y no se comparte. Sin key, SignAI usa Web Speech.")}
            </p>
            {elevenKeyMissing && (
              <p className="mt-3 flex items-start gap-2 rounded-xl border border-aviso/40 bg-aviso/10 px-3 py-2 text-sm 2xl:text-base text-aviso">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{t("Falta la API key: mientras tanto se usará la voz del sistema.")}</span>
              </p>
            )}
          </ContentCard>
        )}

        <ContentCard as="section" data-tutorial="ajustes-velocidad" className="mb-4 sm:mb-6 2xl:mb-8 transition-all duration-700">
          <h3 className="text-base sm:text-lg 2xl:text-xl font-semibold flex items-center gap-2 mb-3">
            <AudioLines className="text-acento" />
            {t("Velocidad de la voz")}
          </h3>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={settings.rate}
            onChange={(e) => update({ rate: parseFloat(e.target.value) })}
            aria-label={t("Velocidad de la voz")}
            aria-valuetext={t("{n} veces", { n: settings.rate.toFixed(1) })}
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
              {t("Tipo de voz")}
            </h3>
            {vocesEs.length > 0 ? (
              <FancyDropdown
                value={settings[claveVoz] || ""}
                onChange={(id) => update({ [claveVoz]: id })}
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
                {t("Cargando voces disponibles…")}
              </p>
            )}
          </ContentCard>
        )}

        {settings.provider === "elevenlabs" && (
          <ContentCard as="section" className="mb-4 sm:mb-6 2xl:mb-8 transition-all duration-700">
            <h3 className="text-base sm:text-lg 2xl:text-xl font-semibold flex items-center gap-2 mb-3">
              <Speech className="text-acento" />
              {t("Tipo de voz")}
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
              speaking ? stop() : speak(t("Hola, soy SignAI. Esta es tu voz seleccionada."))
            }
            className={`inline-flex items-center gap-2 px-5 sm:px-6 2xl:px-8 py-2 sm:py-2.5 2xl:py-3 rounded-xl font-semibold text-sm sm:text-base 2xl:text-lg shadow-lg transition-all active:scale-95 text-acento-texto ${
              speaking ? "bg-error animate-pulse" : "bg-acento hover:bg-acento-fuerte"
            }`}
          >
            {speaking ? (
              <>
                <Square className="w-4 h-4" fill="currentColor" />
                {t("Detener")}
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4" />
                {t("Probar voz")}
              </>
            )}
          </button>
        </ContentCard>

        <ContentCard as="section" className="mb-4 sm:mb-6 2xl:mb-8 transition-all duration-700">
          <h3 className="text-base sm:text-lg 2xl:text-xl font-semibold flex items-center gap-2 mb-2">
            <Gamepad2 className="text-acento" />
            {t("Sonido en los juegos")}
          </h3>
          <Interruptor
            activo={audioJuegos.efectos}
            onCambio={(v) => cambiarAudioJuegos({ efectos: v })}
            etiqueta="Efectos de sonido"
            descripcion="Un sonido al acertar, al fallar y al terminar la partida."
          />
          <Interruptor
            activo={audioJuegos.voz}
            onCambio={(v) => cambiarAudioJuegos({ voz: v })}
            etiqueta="Decir la palabra en voz alta"
            descripcion="Al contestar, se lee la palabra o letra correcta con la voz del sistema."
          />
        </ContentCard>

        <ContentCard as="section" data-tutorial="ajustes-camara" className="transition-all duration-700">
          <h3 className="text-base sm:text-lg 2xl:text-xl font-semibold flex items-center gap-2 mb-3">
            <Camera className="text-acento" />
            {t("Cámara")}
          </h3>
          {camaras.length > 0 ? (
            <FancyDropdown
              value={camaraSeleccionada}
              onChange={(indice) => cambiarCamara(indice)}
              options={camaras.map((cam) => ({
                id: cam.indice,
                label: cam.nombre,
                hint: cam.indice === camaraSeleccionada ? "En uso" : undefined,
                Icon: Camera,
              }))}
            />
          ) : (
            <p className="text-sm 2xl:text-base text-sutil">
              {cargandoCamaras
                ? t("Buscando cámaras…")
                : t("No se detectó ninguna cámara. Conéctala y vuelve a esta pantalla.")}
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
