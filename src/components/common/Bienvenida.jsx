import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Eraser, Undo2, Sparkles } from "lucide-react";
import { LienzoFirma, FirmaAnimada, TINTAS } from "./Firma";
import NombreEnSenas, { letrasDe } from "./NombreEnSenas";
import { useIdioma } from "../../i18n";
import { guardarPerfil } from "../../utils/perfil";
import useAudioJuego from "../../hooks/useAudioJuego";
import useKidMode from "../../hooks/useKidMode";

// Primera vez que se abre la app: la persona dibuja su nombre, opcionalmente
// lo escribe, ve cómo se deletrea en LSM y entra. Todo queda en esta compu.

const pasoAnim = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.35, ease: "easeOut" } },
  exit: { opacity: 0, x: -40, transition: { duration: 0.2 } },
};

export default function Bienvenida() {
  const kid = useKidMode();
  const fuente = kid ? "font-comic" : "";
  const { decir, fin } = useAudioJuego();
  const { t } = useIdioma();

  const [paso, setPaso] = useState(0);
  const [trazos, setTrazos] = useState([]);
  const [tintaId, setTintaId] = useState("marca");
  const [nombre, setNombre] = useState("");

  const letras = useMemo(() => letrasDe(nombre), [nombre]);
  const nombreLimpio = nombre.trim();
  const tieneLetras = letras.some((l) => l !== " ");

  // Pasos: 0 hola · 1 dibuja · 2 tu nombre en señas · 3 listo
  // El paso 2 sale SIEMPRE (antes se saltaba si no se escribía el nombre y
  // la usuaria nunca lo veía): si falta el nombre, ahí mismo se pide.
  const siguiente = () => setPaso((p) => Math.min(p + 1, 3));
  const atras = () => setPaso((p) => Math.max(p - 1, 0));

  useEffect(() => {
    if (paso === 3) {
      fin();
      decir(nombreLimpio ? t("¡Hola, {nombre}! Bienvenido a SignAI", { nombre: nombreLimpio }) : t("¡Bienvenido a SignAI!"), 600);
    }
  }, [paso]); // eslint-disable-line react-hooks/exhaustive-deps

  const terminar = () => guardarPerfil({ nombre: nombreLimpio, trazos, tinta: tintaId });
  const omitir = () => guardarPerfil({ nombre: "", trazos: [], tinta: tintaId, omitido: true });

  const totalPuntos = 4;
  const puntoActual = paso;

  return (
    <div className="fixed inset-0 z-[200] bg-fondo text-texto flex items-center justify-center overflow-y-auto p-4">
      {/* Manchas de color de fondo, lentas */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-32 -left-32 w-[28rem] h-[28rem] rounded-full blur-3xl opacity-25"
          style={{ background: "rgb(var(--cat-1))" }}
          animate={{ x: [0, 60, 0], y: [0, 40, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-40 -right-24 w-[30rem] h-[30rem] rounded-full blur-3xl opacity-20"
          style={{ background: "rgb(var(--cat-5))" }}
          animate={{ x: [0, -50, 0], y: [0, -30, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="relative w-full max-w-2xl">
        <div className="bg-superficie/90 backdrop-blur-md border border-borde rounded-3xl shadow-2xl p-[clamp(1.25rem,4vh,2.5rem)] overflow-hidden">
          <AnimatePresence mode="wait">
            {paso === 0 && (
              <motion.div key="hola" {...pasoAnim} className="text-center flex flex-col items-center gap-4">
                <motion.div
                  className="text-7xl sm:text-8xl"
                  animate={{ rotate: [0, 18, -8, 18, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1 }}
                  style={{ transformOrigin: "70% 80%" }}
                >
                  👋
                </motion.div>
                <h1 className={`text-3xl sm:text-4xl font-extrabold ${fuente}`}>
                  {t("¡Hola! Bienvenido a")}{" "}
                  <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--degradado-marca)" }}>
                    SignAI
                  </span>
                </h1>
                <p className={`text-sutil text-base sm:text-lg max-w-md ${fuente}`}>
                  {t("Antes de empezar, queremos conocerte. Solo toma unos segundos.")}
                </p>
                <button onClick={siguiente} className={`mt-2 inline-flex items-center gap-2 bg-acento hover:bg-acento-fuerte text-acento-texto px-8 py-3.5 rounded-xl font-semibold text-lg shadow-lg hover:scale-[1.03] active:scale-95 transition ${fuente}`}>
                  {t("Empezar")} <ArrowRight size={20} />
                </button>
              </motion.div>
            )}

            {paso === 1 && (
              <motion.div key="dibuja" {...pasoAnim} className="flex flex-col gap-4">
                <div className="text-center">
                  <h2 className={`text-2xl sm:text-3xl font-extrabold ${fuente}`}>{t("Escribe tu nombre")} ✍️</h2>
                  <p className={`text-sutil text-sm sm:text-base mt-1 ${fuente}`}>
                    {t("Dibújalo con el mouse (o con el dedo). Será tu firma en SignAI.")}
                  </p>
                </div>

                <LienzoFirma trazos={trazos} onCambio={setTrazos} tintaId={tintaId} />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2" role="radiogroup" aria-label={t("Color de tinta")}>
                    {TINTAS.map((tinta) => (
                      <button
                        key={tinta.id}
                        role="radio"
                        aria-checked={tintaId === tinta.id}
                        title={t(tinta.nombre)}
                        onClick={() => setTintaId(tinta.id)}
                        className={`w-8 h-8 rounded-full border-2 transition ${tintaId === tinta.id ? "border-texto scale-110" : "border-transparent hover:scale-105"}`}
                        style={{
                          background:
                            tinta.stops.length > 1
                              ? `linear-gradient(135deg, ${tinta.stops.map((s) => `rgb(var(${s}))`).join(", ")})`
                              : `rgb(var(${tinta.stops[0]}))`,
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTrazos((t) => t.slice(0, -1))}
                      disabled={!trazos.length}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-superficie-2 hover:bg-borde disabled:opacity-40 transition"
                    >
                      <Undo2 size={16} /> {t("Deshacer")}
                    </button>
                    <button
                      onClick={() => setTrazos([])}
                      disabled={!trazos.length}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-superficie-2 hover:bg-borde disabled:opacity-40 transition"
                    >
                      <Eraser size={16} /> {t("Borrar")}
                    </button>
                  </div>
                </div>

                <label className="flex flex-col gap-1">
                  <span className={`text-sm text-sutil ${fuente}`}>
                    {t("¿Cómo se escribe?")} <span className="opacity-70">{t("(para saludarte y enseñarte tu nombre en señas)")}</span>
                  </span>
                  <input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value.slice(0, 30))}
                    onKeyDown={(e) => e.key === "Enter" && trazos.length && siguiente()}
                    placeholder={t("Tu nombre")}
                    className="w-full rounded-xl border border-borde bg-superficie-2 px-4 py-2.5 text-base text-texto focus:outline-none focus:border-acento"
                  />
                </label>

                <div className="flex items-center justify-between pt-1">
                  <button onClick={atras} className="inline-flex items-center gap-1.5 text-sutil hover:text-texto px-2 py-2 transition">
                    <ArrowLeft size={18} /> {t("Atrás")}
                  </button>
                  <button
                    onClick={siguiente}
                    disabled={!trazos.length}
                    title={trazos.length ? "" : t("Dibuja tu nombre primero")}
                    className={`inline-flex items-center gap-2 bg-acento hover:bg-acento-fuerte text-acento-texto px-6 py-3 rounded-xl font-semibold shadow-lg active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none ${fuente}`}
                  >
                    {t("Siguiente")} <ArrowRight size={18} />
                  </button>
                </div>
              </motion.div>
            )}

            {paso === 2 && (
              <motion.div key="senas" {...pasoAnim} className="flex flex-col gap-5 text-center">
                <div>
                  <h2 className={`text-2xl sm:text-3xl font-extrabold ${fuente}`}>
                    {tieneLetras ? (
                      <>
                        {t("Así se deletrea")} <span className="text-acento">{nombreLimpio}</span> {t("en señas")}
                      </>
                    ) : (
                      t("Tu nombre en señas")
                    )}
                  </h2>
                  <p className={`text-sutil text-sm sm:text-base mt-1 ${fuente}`}>
                    {tieneLetras
                      ? t("¡Inténtalo con tu mano! Es lo primero que se aprende en LSM.")
                      : t("Escribe tu nombre y te enseñamos a deletrearlo con las manos.")}
                  </p>
                </div>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value.slice(0, 30))}
                  placeholder={t("Tu nombre")}
                  className="w-full max-w-sm mx-auto rounded-xl border border-borde bg-superficie-2 px-4 py-2.5 text-lg text-center text-texto focus:outline-none focus:border-acento"
                />
                <div className="max-h-[45vh] overflow-y-auto py-1">
                  <NombreEnSenas nombre={nombre} fuente={fuente} />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <button onClick={atras} className="inline-flex items-center gap-1.5 text-sutil hover:text-texto px-2 py-2 transition">
                    <ArrowLeft size={18} /> {t("Atrás")}
                  </button>
                  <button onClick={siguiente} className={`inline-flex items-center gap-2 bg-acento hover:bg-acento-fuerte text-acento-texto px-6 py-3 rounded-xl font-semibold shadow-lg active:scale-95 transition ${fuente}`}>
                    {tieneLetras ? t("Siguiente") : t("Saltar")} <ArrowRight size={18} />
                  </button>
                </div>
              </motion.div>
            )}

            {paso === 3 && (
              <motion.div key="listo" {...pasoAnim} className="flex flex-col items-center gap-4 text-center">
                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 12 }}
                  className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
                  style={{ backgroundImage: "var(--degradado-marca)" }}
                >
                  <Sparkles className="text-white" size={28} />
                </motion.div>
                <h2 className={`text-2xl sm:text-3xl font-extrabold ${fuente}`}>
                  {nombreLimpio ? t("¡Listo, {nombre}!", { nombre: nombreLimpio }) : t("¡Listo!")}
                </h2>
                <div className="w-full flex justify-center py-2">
                  <FirmaAnimada
                    trazos={trazos}
                    tintaId={tintaId}
                    retraso={0.4}
                    duracion={2}
                    style={{ maxHeight: "clamp(5rem, 20vh, 10rem)", maxWidth: "100%" }}
                  />
                </div>
                <p className={`text-sutil text-sm sm:text-base max-w-md ${fuente}`}>
                  {t("Así te vamos a saludar cada vez que abras SignAI. Puedes cambiarlo cuando quieras en Ajustes.")}
                </p>
                <div className="w-full flex items-center justify-between pt-1">
                  <button onClick={atras} className="inline-flex items-center gap-1.5 text-sutil hover:text-texto px-2 py-2 transition">
                    <ArrowLeft size={18} /> {t("Atrás")}
                  </button>
                  <button onClick={terminar} className={`inline-flex items-center gap-2 bg-acento hover:bg-acento-fuerte text-acento-texto px-8 py-3 rounded-xl font-semibold text-lg shadow-lg hover:scale-[1.03] active:scale-95 transition ${fuente}`}>
                    {t("Entrar")} <ArrowRight size={20} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-4 flex items-center justify-between px-2">
          <div className="flex gap-1.5" aria-hidden>
            {Array.from({ length: totalPuntos }).map((_, i) => (
              <span
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${i === puntoActual ? "w-6 bg-acento" : i < puntoActual ? "w-2 bg-acento/50" : "w-2 bg-borde"}`}
              />
            ))}
          </div>
          {paso < 3 && (
            <button onClick={omitir} className="text-sm text-sutil hover:text-texto underline-offset-4 hover:underline transition">
              {t("Omitir por ahora")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
