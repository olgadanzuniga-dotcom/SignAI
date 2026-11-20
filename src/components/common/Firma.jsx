import React, { useEffect, useId, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { tr } from "../../i18n";

// Firma a mano: un lienzo para dibujar el nombre con mouse, dedo o lápiz, y
// una versión SVG que lo vuelve a "escribir" animado.
//
// Los trazos se guardan como puntos en píxeles CSS del lienzo; la versión SVG
// recorta al rectángulo que ocupan, así que da igual dónde se dibujó.

// Los colores son tokens del tema (no valores fijos) para que la firma se
// siga leyendo al cambiar entre claro y oscuro.
export const TINTAS = [
  { id: "marca", nombre: "Arcoíris", stops: ["--cat-1", "--cat-3", "--cat-5", "--cat-7"] },
  { id: "indigo", nombre: "Índigo", stops: ["--cat-1"] },
  { id: "magenta", nombre: "Magenta", stops: ["--cat-5"] },
  { id: "teal", nombre: "Turquesa", stops: ["--cat-9"] },
  { id: "ambar", nombre: "Ámbar", stops: ["--cat-8"] },
];

const tinta = (id) => TINTAS.find((t) => t.id === id) || TINTAS[0];

const GROSOR = 5;

// Los tokens son canales sueltos ("79 70 229"); canvas quiere un color CSS.
const leerToken = (nombre, alfa = 1) => {
  const canales = (getComputedStyle(document.documentElement).getPropertyValue(nombre).trim() || "79 70 229")
    .split(/\s+/)
    .join(", ");
  return `rgba(${canales}, ${alfa})`;
};

// Curva suave por los puntos medios: la línea no se ve "en picos" aunque el
// mouse reporte pocos puntos.
export function trazoAPath(pts) {
  if (!pts.length) return "";
  const [x0, y0] = pts[0];
  if (pts.length === 1) return `M${x0} ${y0} l0.01 0`;
  let d = `M${x0} ${y0}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    const [nx, ny] = pts[i + 1];
    d += ` Q${x} ${y} ${(x + nx) / 2} ${(y + ny) / 2}`;
  }
  const [xl, yl] = pts[pts.length - 1];
  return d + ` L${xl} ${yl}`;
}

function pintarTrazo(ctx, pts) {
  if (!pts.length) return;
  ctx.beginPath();
  const [x0, y0] = pts[0];
  ctx.moveTo(x0, y0);
  if (pts.length === 1) ctx.lineTo(x0 + 0.01, y0);
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    const [nx, ny] = pts[i + 1];
    ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
  }
  if (pts.length > 1) ctx.lineTo(...pts[pts.length - 1]);
  ctx.stroke();
}

/**
 * Lienzo controlado: `trazos` viene de fuera y `onCambio` recibe la lista nueva
 * al soltar cada trazo (así deshacer/borrar son solo cambios de estado).
 */
export function LienzoFirma({ trazos, onCambio, tintaId = "marca", className = "", alto = "clamp(9rem, 30vh, 16rem)" }) {
  const cajaRef = useRef(null);
  const lienzoRef = useRef(null);
  const chispasRef = useRef(null);
  const actualRef = useRef(null); // trazo en curso
  const particulasRef = useRef([]);
  const rafRef = useRef(0);
  const trazosRef = useRef(trazos);
  trazosRef.current = trazos;

  const estilo = (ctx, w) => {
    const t = tinta(tintaId);
    if (t.stops.length === 1) {
      ctx.strokeStyle = leerToken(t.stops[0]);
    } else {
      const g = ctx.createLinearGradient(0, 0, w, 0);
      t.stops.forEach((s, i) => g.addColorStop(i / (t.stops.length - 1), leerToken(s)));
      ctx.strokeStyle = g;
    }
    ctx.lineWidth = GROSOR;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowBlur = 10;
    ctx.shadowColor = leerToken(t.stops[Math.floor(t.stops.length / 2)], 0.45);
  };

  const redibujar = () => {
    const c = lienzoRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = c.width / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, c.height / dpr);
    estilo(ctx, w);
    for (const t of trazosRef.current) pintarTrazo(ctx, t);
    if (actualRef.current) pintarTrazo(ctx, actualRef.current);
  };

  // Ajusta la resolución real al tamaño en pantalla (nítido en pantallas HiDPI).
  useEffect(() => {
    const caja = cajaRef.current;
    if (!caja) return;
    const ajustar = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = caja.getBoundingClientRect();
      for (const c of [lienzoRef.current, chispasRef.current]) {
        if (!c) continue;
        c.width = Math.round(width * dpr);
        c.height = Math.round(height * dpr);
      }
      redibujar();
    };
    ajustar();
    const ro = new ResizeObserver(ajustar);
    ro.observe(caja);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(redibujar); // trazos o tinta cambiaron

  // Chispas que salen de la punta mientras se dibuja.
  const animarChispas = () => {
    const c = chispasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, c.width / dpr, c.height / dpr);
    const t = tinta(tintaId);
    const vivas = [];
    for (const p of particulasRef.current) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.vida -= 0.035;
      if (p.vida <= 0) continue;
      vivas.push(p);
      ctx.globalAlpha = p.vida;
      ctx.fillStyle = leerToken(t.stops[p.tono % t.stops.length]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.vida, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    particulasRef.current = vivas;
    rafRef.current = vivas.length ? requestAnimationFrame(animarChispas) : 0;
  };

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const soltarChispas = (x, y) => {
    for (let i = 0; i < 2; i++) {
      particulasRef.current.push({
        x, y,
        vx: (Math.random() - 0.5) * 2.4,
        vy: (Math.random() - 0.8) * 2,
        r: 1.5 + Math.random() * 2.5,
        vida: 1,
        tono: Math.floor(Math.random() * 4),
      });
    }
    if (!rafRef.current) rafRef.current = requestAnimationFrame(animarChispas);
  };

  const punto = (e) => {
    const r = lienzoRef.current.getBoundingClientRect();
    return [Math.round((e.clientX - r.left) * 10) / 10, Math.round((e.clientY - r.top) * 10) / 10];
  };

  const alBajar = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    actualRef.current = [punto(e)];
    redibujar();
  };

  const alMover = (e) => {
    if (!actualRef.current) return;
    const p = punto(e);
    const ult = actualRef.current[actualRef.current.length - 1];
    if (Math.hypot(p[0] - ult[0], p[1] - ult[1]) < 1.5) return;
    actualRef.current.push(p);
    redibujar();
    soltarChispas(p[0], p[1]);
  };

  const alSoltar = () => {
    const t = actualRef.current;
    actualRef.current = null;
    if (t && t.length) onCambio([...trazosRef.current, t]);
  };

  return (
    <div
      ref={cajaRef}
      className={`relative w-full rounded-2xl border-2 border-dashed border-borde bg-superficie overflow-hidden select-none ${className}`}
      style={{ height: alto, touchAction: "none" }}
    >
      {/* Renglón guía */}
      <div className="absolute left-6 right-6 bottom-[28%] border-b-2 border-dotted border-borde pointer-events-none" />
      {!trazos.length && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-sutil/70 text-lg sm:text-xl font-medium">{tr("✍️ Escribe aquí tu nombre")}</div>
      )}
      <canvas
        ref={lienzoRef}
        className="absolute inset-0 w-full h-full cursor-crosshair"
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        onPointerLeave={(e) => e.buttons === 0 && alSoltar()}
        aria-label={tr("Área para dibujar tu nombre")}
      />
      <canvas ref={chispasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
    </div>
  );
}

/** La firma guardada, escrita de nuevo trazo por trazo. */
export function FirmaAnimada({ trazos, tintaId = "marca", duracion = 1.8, retraso = 0, className = "", style }) {
  const id = useId().replace(/:/g, "");
  const t = tinta(tintaId);

  const { caja, partes } = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const largos = trazos.map((pts) => {
      let l = 0;
      pts.forEach(([x, y], i) => {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        if (i) l += Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1]);
      });
      return Math.max(l, 4);
    });
    const total = largos.reduce((a, b) => a + b, 0) || 1;
    let acumulado = 0;
    const partes = trazos.map((pts, i) => {
      const inicio = acumulado / total;
      acumulado += largos[i];
      return { d: trazoAPath(pts), inicio, fraccion: largos[i] / total };
    });
    const m = GROSOR * 2;
    return {
      caja: [minX - m, minY - m, Math.max(maxX - minX, 1) + 2 * m, Math.max(maxY - minY, 1) + 2 * m],
      partes,
    };
  }, [trazos]);

  if (!trazos?.length) return null;

  const trazo = t.stops.length === 1 ? `rgb(var(${t.stops[0]}))` : `url(#firma-${id})`;

  return (
    <svg
      viewBox={caja.join(" ")}
      className={className}
      style={{ overflow: "visible", ...style }}
      role="img"
      aria-label={tr("Tu nombre escrito a mano")}
    >
      {t.stops.length > 1 && (
        <defs>
          <linearGradient id={`firma-${id}`} gradientUnits="userSpaceOnUse" x1={caja[0]} x2={caja[0] + caja[2]} y1="0" y2="0">
            {t.stops.map((s, i) => (
              <stop key={s} offset={i / (t.stops.length - 1)} stopColor={`rgb(var(${s}))`} />
            ))}
          </linearGradient>
        </defs>
      )}
      {partes.map((p, i) => (
        <motion.path
          key={i}
          d={p.d}
          fill="none"
          stroke={trazo}
          strokeWidth={GROSOR}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{
            pathLength: { delay: retraso + p.inicio * duracion, duration: Math.max(p.fraccion * duracion, 0.08), ease: "easeInOut" },
            opacity: { delay: retraso + p.inicio * duracion, duration: 0.01 },
          }}
        />
      ))}
    </svg>
  );
}
