import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Lock, Flame, CalendarDays, Trophy, Type, Lightbulb, RotateCcw, Gamepad2, MessageSquareText } from "lucide-react";
import PageHeader from "../common/PageHeader";
import { FirmaAnimada } from "../common/Firma";
import useCerrarSidebar from "../../hooks/useCerrarSidebar";
import { usePerfil } from "../../utils/perfil";
import { useProgreso, resumir, borrarProgreso, fechaLocal, NOMBRE_JUEGO } from "../../utils/progreso";
import { tr } from "../../i18n";

// Panel para papás y maestros: lo que el peque ha practicado, lo que domina y
// lo que le cuesta. Protegido con una multiplicación (no es seguridad, solo
// para que el niño no entre y reinicie su progreso por accidente).
//
// Va con letra normal aunque esté el modo Kids: lo leen adultos.

const LETRAS = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");
// Inicial del dia; en ingles se traducen al mostrar (Do -> Su...).
const DIAS_CORTOS = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];

const nuevaPregunta = () => {
  const a = 3 + Math.floor(Math.random() * 7);
  const b = 3 + Math.floor(Math.random() * 7);
  return { a, b };
};

function Candado({ onAbrir }) {
  const navigate = useNavigate();
  const [q, setQ] = useState(nuevaPregunta);
  const [valor, setValor] = useState("");
  const [mal, setMal] = useState(0);

  const comprobar = (e) => {
    e?.preventDefault();
    if (Number(valor) === q.a * q.b) return onAbrir();
    setMal((n) => n + 1);
    setValor("");
    setQ(nuevaPregunta());
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <motion.form
        key={mal}
        onSubmit={comprobar}
        initial={mal ? { x: -12 } : { opacity: 0, y: 16 }}
        animate={mal ? { x: [12, -8, 6, 0] } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-sm bg-superficie border border-borde rounded-3xl shadow-xl p-6 sm:p-8 text-center flex flex-col items-center gap-4"
      >
        <div className="w-14 h-14 rounded-2xl bg-acento-suave flex items-center justify-center">
          <Lock className="text-acento" size={26} />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-texto">{tr("Solo para adultos")}</h2>
          <p className="text-sm text-sutil mt-1">{tr("Resuelve para entrar al panel de papás y maestros.")}</p>
        </div>
        <label className="text-3xl font-bold text-texto flex items-center gap-3">
          {q.a} × {q.b} =
          <input
            autoFocus
            inputMode="numeric"
            value={valor}
            onChange={(e) => setValor(e.target.value.replace(/\D/g, "").slice(0, 3))}
            aria-label={tr("Resultado de {a} por {b}", { a: q.a, b: q.b })}
            className="w-20 rounded-xl border border-borde bg-superficie-2 px-2 py-1.5 text-center text-2xl text-texto focus:outline-none focus:border-acento"
          />
        </label>
        {mal > 0 && <p className="text-sm text-error">{tr("Esa no es. Intenta con esta otra.")}</p>}
        <div className="flex w-full gap-2 pt-1">
          <button type="button" onClick={() => navigate(-1)} className="flex-1 px-4 py-2.5 rounded-xl bg-superficie-2 text-texto font-medium hover:bg-borde transition">{tr("Volver")}</button>
          <button type="submit" disabled={!valor} className="flex-1 px-4 py-2.5 rounded-xl bg-acento hover:bg-acento-fuerte text-acento-texto font-semibold disabled:opacity-40 transition">{tr("Entrar")}</button>
        </div>
      </motion.form>
    </div>
  );
}

const Tarjeta = ({ titulo, icono: Icono, children, className = "", delay = 0 }) => (
  <motion.section
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
    className={`bg-superficie border border-borde rounded-2xl shadow-sm p-4 sm:p-5 ${className}`}
  >
    <h3 className="text-base sm:text-lg font-semibold text-texto flex items-center gap-2 mb-3">
      <Icono size={20} className="text-acento" /> {titulo}
    </h3>
    {children}
  </motion.section>
);

function estadoDe(it) {
  if (!it || !((it.ok || 0) + (it.mal || 0))) return "nada";
  const ok = it.ok || 0;
  const total = ok + (it.mal || 0);
  if (ok >= 2 && ok / total >= 0.7) return "domina";
  if ((it.mal || 0) >= ok) return "cuesta";
  return "practica";
}

const ESTILO_ESTADO = {
  domina: { clase: "bg-exito text-white border-exito", texto: "La domina" },
  practica: { clase: "bg-aviso/20 text-texto border-aviso/60", texto: "Practicando" },
  cuesta: { clase: "bg-error/15 text-error border-error/60", texto: "Le cuesta" },
  nada: { clase: "bg-superficie-2 text-sutil border-borde", texto: "Sin practicar" },
};

const bonita = (s) => (s.length > 1 ? s.charAt(0) + s.slice(1).toLowerCase() : s);

function haceCuanto(ms) {
  if (!ms) return tr("nunca");
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 2) return tr("hace un momento");
  if (min < 60) return tr("hace {n} min", { n: min });
  const h = Math.round(min / 60);
  if (h < 24) return tr("hace {n} h", { n: h });
  const d = Math.round(h / 24);
  return d === 1 ? tr("ayer") : tr("hace {n} días", { n: d });
}

function Panel() {
  const perfil = usePerfil();
  const p = useProgreso();
  const r = resumir(p);
  const [confirmar, setConfirmar] = useState(false);
  const quien = perfil?.nombre || tr("tu peque");

  const datos = useMemo(() => {
    const items = Object.entries(p.items).filter(([, it]) => it && typeof it === "object");
    const palabras = items.filter(([k]) => k.length > 1);
    const cuestan = palabras.filter(([, it]) => estadoDe(it) === "cuesta").sort((a, b) => (b[1].mal || 0) - (a[1].mal || 0)).map(([k]) => k);
    const domina = palabras.filter(([, it]) => estadoDe(it) === "domina").map(([k]) => k);
    const letrasCuestan = LETRAS.filter((l) => estadoDe(p.items[l]) === "cuesta");

    const ultima = Math.max(
      0,
      ...items.map(([, it]) => Number(it.ultima) || 0),
      ...Object.values(p.juegos).map((j) => Number(j?.fecha) || 0)
    );

    const set = new Set(p.dias);
    const dias = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      return { fecha: fechaLocal(d), dia: DIAS_CORTOS[d.getDay()], num: d.getDate(), jugo: set.has(fechaLocal(d)) };
    });

    const juegos = Object.entries(NOMBRE_JUEGO).map(([id, nombre]) => ({ id, nombre, ...(p.juegos[id] || {}) }));

    // Consejos generados con lo que hay.
    const consejos = [];
    if (letrasCuestan.length)
      consejos.push(tr("Repasen juntos {letras} en \"Letra que falta\" o en Repaso ABC. Pídanle que haga la seña con su mano mientras la ve.", { letras: letrasCuestan.slice(0, 4).join(", ") }));
    if (cuestan.length)
      consejos.push(tr("Las palabras {palabras} le están costando: busquen esas señas en Aprender y úsenlas en casa durante el día.", { palabras: cuestan.slice(0, 3).map(bonita).join(", ") }));
    if (!r.racha)
      consejos.push(tr("Jugar 5 minutos diarios ayuda más que una sesión larga a la semana. ¡Una racha corta es un buen comienzo!"));
    else if (r.racha >= 3) consejos.push(tr("¡Lleva {n} días seguidos! Celébrenlo para que no pierda el ritmo.", { n: r.racha }));
    if (!p.juegos.desafio?.partidas && r.partidas >= 3)
      consejos.push(tr("Ya está listo para el Modo desafío: ahí hace las señas frente a la cámara y la app le dice si están bien."));
    if (!consejos.length) consejos.push(tr("Todo va muy bien. Sigan jugando para ver aquí su avance."));

    return { cuestan, domina, ultima, dias, juegos, consejos, diasJugados: dias.filter((d) => d.jugo).length };
  }, [p, r.racha, r.partidas]);

  const stat = (Icono, tono, valor, etiqueta) => (
    <div className="bg-superficie border border-borde rounded-2xl p-4 flex items-center gap-3">
      <span className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center bg-[rgb(var(--tono))]/[0.14]" style={{ "--tono": `var(--cat-${tono})` }}>
        <Icono size={22} className="text-[rgb(var(--tono))]" />
      </span>
      <div className="leading-tight">
        <div className="text-2xl font-extrabold text-texto">{valor}</div>
        <div className="text-xs sm:text-sm text-sutil">{etiqueta}</div>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-10 flex flex-col gap-4 sm:gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-sutil">{tr("Panel para papás y maestros")}</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-texto flex items-end gap-3 flex-wrap">{tr("Progreso de")}{perfil?.trazos?.length ? (
              <FirmaAnimada trazos={perfil.trazos} tintaId={perfil.tinta} duracion={1.4} style={{ height: "2.6rem", maxWidth: "14rem" }} />
            ) : (
              <span className="text-acento">{quien}</span>
            )}
          </h2>
        </div>
        <p className="text-sm text-sutil">{tr("Última actividad:")}{" "}<span className="text-texto font-medium">{haceCuanto(datos.ultima)}</span></p>
      </div>

      {!r.partidas && !Object.keys(p.items).length ? (
        <div className="bg-superficie border border-borde rounded-2xl p-8 text-center text-sutil">{tr("Todavía no hay partidas. Cuando")}{" "}{quien}{" "}{tr("juegue, aquí verás qué letras y palabras domina y cuáles le cuestan.")}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stat(Flame, 7, `${r.racha} ${r.racha === 1 ? tr("día") : tr("días")}`, tr("racha actual"))}
            {stat(CalendarDays, 9, `${datos.diasJugados}/14`, tr("días jugados (2 semanas)"))}
            {stat(Trophy, 8, r.partidas, r.partidas === 1 ? tr("partida jugada") : tr("partidas jugadas"))}
            {stat(Type, 1, `${r.letrasDominadas}/${r.totalLetras}`, tr("letras dominadas"))}
          </div>

          <Tarjeta titulo="Últimas 2 semanas" icono={CalendarDays} delay={0.05}>
            <div className="grid gap-1.5 sm:gap-2" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
              {datos.dias.map((d) => (
                <div key={d.fecha} className="flex flex-col items-center gap-1">
                  <span className="text-[11px] text-sutil">{tr(d.dia)}</span>
                  <span
                    title={d.jugo ? tr("Jugó este día") : tr("No jugó")}
                    className={`w-full aspect-square max-w-[2.75rem] rounded-lg flex items-center justify-center text-xs font-semibold ${
                      d.jugo ? "bg-exito text-white" : "bg-superficie-2 text-sutil"
                    } ${d.fecha === fechaLocal() ? "ring-2 ring-acento ring-offset-2 ring-offset-superficie" : ""}`}
                  >
                    {d.num}
                  </span>
                </div>
              ))}
            </div>
          </Tarjeta>

          <div className="grid lg:grid-cols-5 gap-4 sm:gap-5">
            <Tarjeta titulo="Abecedario" icono={Type} className="lg:col-span-3" delay={0.1}>
              <div className="grid grid-cols-7 sm:grid-cols-9 gap-1.5 sm:gap-2">
                {LETRAS.map((l) => {
                  const est = estadoDe(p.items[l]);
                  const it = p.items[l];
                  return (
                    <span
                      key={l}
                      title={it ? tr("{estado}: {ok} bien, {mal} mal", { estado: tr(ESTILO_ESTADO[est].texto), ok: it.ok || 0, mal: it.mal || 0 }) : tr("Sin practicar")}
                      className={`aspect-square rounded-lg border flex items-center justify-center font-bold text-base sm:text-lg ${ESTILO_ESTADO[est].clase}`}
                    >
                      {l}
                    </span>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs sm:text-sm text-sutil">
                {Object.entries(ESTILO_ESTADO).map(([k, v]) => (
                  <span key={k} className="flex items-center gap-1.5">
                    <span className={`w-3.5 h-3.5 rounded border ${v.clase}`} /> {tr(v.texto)}
                  </span>
                ))}
              </div>
            </Tarjeta>

            <Tarjeta titulo="Consejos" icono={Lightbulb} className="lg:col-span-2" delay={0.15}>
              <ul className="flex flex-col gap-2.5">
                {datos.consejos.map((c, i) => (
                  <li key={i} className="flex gap-2 text-sm sm:text-base text-texto leading-snug">
                    <span className="text-acento mt-0.5">•</span> {c}
                  </li>
                ))}
              </ul>
            </Tarjeta>
          </div>

          <div className="grid lg:grid-cols-2 gap-4 sm:gap-5">
            <Tarjeta titulo="Juegos" icono={Gamepad2} delay={0.2}>
              <div className="flex flex-col divide-y divide-borde">
                {datos.juegos.map((j) => (
                  <div key={j.id} className="flex items-center justify-between gap-3 py-2 text-sm sm:text-base">
                    <span className="text-texto font-medium">{tr(j.nombre)}</span>
                    {j.partidas ? (
                      <span className="flex items-center gap-3 text-sutil">
                        <span>{j.partidas} {j.partidas === 1 ? tr("vez") : tr("veces")}</span>
                        <span className="text-texto font-semibold">🏆 {j.mejor}%</span>
                        <span className="hidden sm:inline">{tr("última")}{" "}{j.ultimo}%</span>
                      </span>
                    ) : (
                      <span className="text-sutil text-sm">{tr("sin jugar")}</span>
                    )}
                  </div>
                ))}
              </div>
            </Tarjeta>

            <Tarjeta titulo="Palabras" icono={MessageSquareText} delay={0.25}>
              <p className="text-sm text-sutil mb-1.5">{tr("Le cuestan")}</p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {datos.cuestan.length ? (
                  datos.cuestan.map((w) => (
                    <span key={w} className="px-2.5 py-1 rounded-lg border border-error/50 bg-error/10 text-error text-sm font-medium">{bonita(w)}</span>
                  ))
                ) : (
                  <span className="text-sm text-sutil">{tr("Ninguna por ahora 🎉")}</span>
                )}
              </div>
              <p className="text-sm text-sutil mb-1.5">{tr("Ya las domina")}</p>
              <div className="flex flex-wrap gap-1.5">
                {datos.domina.length ? (
                  datos.domina.map((w) => (
                    <span key={w} className="px-2.5 py-1 rounded-lg bg-exito/15 text-exito text-sm font-medium">{bonita(w)}</span>
                  ))
                ) : (
                  <span className="text-sm text-sutil">{tr("Aún ninguna: se cuenta al acertarla 2 veces o más.")}</span>
                )}
              </div>
            </Tarjeta>
          </div>

          <div className="flex justify-end pt-1">
            {confirmar ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-texto">{tr("¿Borrar todo el progreso? No se puede deshacer.")}</span>
                <button onClick={() => setConfirmar(false)} className="px-3 py-1.5 rounded-lg bg-superficie-2 hover:bg-borde transition">{tr("Cancelar")}</button>
                <button
                  onClick={() => { borrarProgreso(); setConfirmar(false); }}
                  className="px-3 py-1.5 rounded-lg bg-error text-white font-semibold hover:brightness-110 transition"
                >{tr("Sí, borrar")}</button>
              </div>
            ) : (
              <button onClick={() => setConfirmar(true)} className="inline-flex items-center gap-1.5 text-sm text-sutil hover:text-error transition">
                <RotateCcw size={15} />{" "}{tr("Reiniciar progreso")}</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function Tutores({ setSidebarOpen }) {
  const [abierto, setAbierto] = useState(false);
  useCerrarSidebar(setSidebarOpen);
  return (
    <div className="relative flex-1 w-full flex flex-col">
      <PageHeader title={tr("Papás y maestros")} />
      {abierto ? <Panel /> : <Candado onAbrir={() => setAbierto(true)} />}
    </div>
  );
}
