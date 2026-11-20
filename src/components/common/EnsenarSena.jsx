import React, { useCallback, useEffect, useRef, useState } from "react";
import { GraduationCap, Trash2, X, Check, RotateCcw } from "lucide-react";
import { HTTP } from "../../utils/signServer";
import { tr, palabraSena } from "../../i18n";

// «Enseñar seña»: la persona hace la seña unas veces frente a SU cámara y el
// motor guarda esas tomas para reconocerla mejor en esa compu (otra cámara,
// otra luz u otra persona). Las tomas viven en %APPDATA%\SignAI del servidor.
const TOMAS_META = 3;

const bonito = (s) => {
  // En ingles se muestra la palabra traducida (AZUL -> Blue).
  const v = palabraSena(s);
  return v ? v.charAt(0) + v.slice(1).toLowerCase() : v;
};

async function llamar(ruta, metodo = "GET") {
  try {
    const r = await fetch(`${HTTP}${ruta}`, { method: metodo });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export default function EnsenarSena({ abierto, onCerrar, evento, onActivoChange }) {
  const [fase, setFase] = useState("elegir"); // elegir | grabando | listo
  const [senas, setSenas] = useState([]);
  const [tomas, setTomas] = useState({});
  const [sena, setSena] = useState("");
  const [hechas, setHechas] = useState(0);
  const [aviso, setAviso] = useState("");
  const [cargando, setCargando] = useState(false);
  const activaRef = useRef(false);

  const refrescar = useCallback(async () => {
    const d = await llamar("/ensenar");
    if (d) {
      setSenas(d.senas || []);
      setTomas(d.tomas || {});
    }
    return d;
  }, []);

  const detener = useCallback(() => {
    if (activaRef.current) {
      activaRef.current = false;
      llamar("/ensenar?sena=", "POST");
    }
    onActivoChange?.(false);
  }, [onActivoChange]);

  useEffect(() => {
    if (!abierto) return;
    setFase("elegir");
    setAviso("");
    setCargando(true);
    refrescar().then((d) => {
      setCargando(false);
      if (!d) setAviso("No pude hablar con el traductor. Espera a que abra la cámara.");
    });
  }, [abierto, refrescar]);

  // Si se cierra la pantalla a media toma, el traductor vuelve a traducir.
  useEffect(() => () => detener(), [detener]);

  const empezar = async (nombre) => {
    setAviso("");
    const r = await llamar(`/ensenar?sena=${encodeURIComponent(nombre)}`, "POST");
    if (!r?.ok) {
      setAviso("No se pudo empezar. Intenta otra vez.");
      return;
    }
    activaRef.current = true;
    onActivoChange?.(true);
    setSena(nombre);
    setHechas(0);
    setFase("grabando");
  };

  // Cada seña que el motor guarda llega aquí.
  useEffect(() => {
    if (!evento || fase !== "grabando" || evento.sena !== sena) return;
    if (!evento.ok) {
      setAviso(evento.msg || "No salió bien, hazla otra vez.");
      return;
    }
    setAviso("");
    const n = hechas + 1;
    setHechas(n);
    if (n >= TOMAS_META) {
      detener();
      setFase("listo");
      refrescar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evento]);

  const borrar = async (nombre) => {
    const r = await llamar(`/ensenar/borrar?sena=${encodeURIComponent(nombre)}`, "POST");
    if (r?.ok) setTomas(r.tomas || {});
  };

  const cerrar = () => {
    detener();
    onCerrar?.();
  };

  if (!abierto) return null;

  // Mientras graba: tarjeta abajo, para que se vea la cámara completa.
  if (fase === "grabando") {
    return (
      <div className="absolute bottom-0 left-0 z-30 w-full px-4 pb-6">
        <div className="mx-auto max-w-xl rounded-2xl bg-black/75 p-5 text-center text-white backdrop-blur-md">
          <p className="text-sm font-medium uppercase tracking-widest text-white/60">{tr("Enseñando")}</p>
          <p className="mt-1 text-4xl font-black text-green-400">{bonito(sena)}</p>
          <p className="mt-3 text-lg">{tr("Haz la seña y")}{" "}<b>{tr("baja las manos")}</b>{" "}{tr("al terminar.")}</p>
          <div className="mt-4 flex justify-center gap-3">
            {Array.from({ length: TOMAS_META }, (_, i) => (
              <div
                key={i}
                className={`flex h-11 w-11 items-center justify-center rounded-full border-2 text-lg font-bold transition-all ${
                  i < hechas
                    ? "border-green-400 bg-green-400 text-black scale-110"
                    : i === hechas
                    ? "border-white animate-pulse"
                    : "border-white/30 text-white/40"
                }`}
              >
                {i < hechas ? <Check size={22} strokeWidth={3} /> : i + 1}
              </div>
            ))}
          </div>
          <p className="mt-3 min-h-[1.5rem] text-amber-300">{tr(aviso)}</p>
          <button
            onClick={() => {
              detener();
              setFase("elegir");
            }}
            className="mt-1 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/25"
          >{tr("Cancelar")}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl bg-neutral-900 p-6 text-white shadow-2xl">
        <button
          onClick={cerrar}
          aria-label={tr("Cerrar")}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
        >
          <X size={22} />
        </button>

        {fase === "listo" ? (
          <div className="py-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-400 text-black">
              <Check size={36} strokeWidth={3} />
            </div>
            <p className="mt-4 text-2xl font-bold">{tr("¡Listo! Ya aprendí")}{" "}{bonito(sena)}</p>
            <p className="mt-2 text-white/70">{tr("Pruébala en el traductor. Si todavía falla, enséñala otra vez: cada vez aprende un poco más.")}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button
                onClick={cerrar}
                className="rounded-xl bg-white px-5 py-2.5 font-semibold text-black hover:bg-white/90"
              >{tr("Probar ahora")}</button>
              <button
                onClick={() => setFase("elegir")}
                className="rounded-xl bg-white/15 px-5 py-2.5 font-semibold hover:bg-white/25"
              >{tr("Enseñar otra")}</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <GraduationCap size={26} />
              <h2 className="text-2xl font-bold">{tr("Enseñar seña")}</h2>
            </div>
            <p className="mt-2 text-white/70">{tr("¿Alguna seña no te sale? Elígela y hazla")}{" "}{TOMAS_META}{" "}{tr("veces. La app la aprenderá con tu cámara y tus manos.")}</p>

            {cargando ? (
              <p className="mt-6 text-center text-white/60">{tr("Cargando…")}</p>
            ) : (
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {senas.map((n) => (
                  <div key={n} className="relative">
                    <button
                      onClick={() => empezar(n)}
                      className="w-full rounded-xl bg-white/10 px-3 py-3 text-left font-semibold hover:bg-white/20"
                    >
                      <span className="block text-lg">{bonito(n)}</span>
                      <span className="block text-xs font-normal text-white/50">
                        {tomas[n] ? `✓ ${tr("enseñada")} (${tomas[n]})` : tr("sin enseñar")}
                      </span>
                    </button>
                    {tomas[n] > 0 && (
                      <button
                        onClick={() => borrar(n)}
                        title={tr("Olvidar lo que enseñé")}
                        className="absolute right-1.5 top-1.5 rounded-md p-1 text-white/40 hover:bg-white/10 hover:text-red-300"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {aviso && <p className="mt-4 text-center text-amber-300">{tr(aviso)}</p>}

            {Object.keys(tomas).length > 0 && (
              <button
                onClick={() => borrar("")}
                className="mx-auto mt-5 flex items-center gap-1.5 text-sm text-white/50 hover:text-white"
              >
                <RotateCcw size={14} />{" "}{tr("Olvidar todo lo enseñado")}</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
