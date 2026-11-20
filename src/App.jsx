import React, { useState, useEffect, useRef } from "react";
import { Menu } from "lucide-react";
import { Routes, Route, Navigate, useLocation, Outlet } from "react-router-dom";
import { CSSTransition, TransitionGroup } from "react-transition-group";

import Sidebar from "./components/Sidebar";
import ErrorBoundary from "./components/common/ErrorBoundary";
import ThemeToggle from "./components/common/ThemeToggle";
import KidModeToggle from "./components/common/KidModeToggle";
import IdiomaToggle from "./components/common/IdiomaToggle";
import { useIdioma, tr } from "./i18n";
import useMediaQuery, { CONSULTA_ESTRECHA } from "./hooks/useMediaQuery";
import { leer } from "./utils/almacen";
import useScrolled from "./hooks/useScrolled";
import { useThemeContext } from "./context/ThemeContext";
import useAutoCamara from "./hooks/useAutoCamara";
import Bienvenida from "./components/common/Bienvenida";
import { usePerfil } from "./utils/perfil";

import Home from "./components/Home.jsx";
import Ajustes from "./components/pages/Ajustes";
import Aprendizaje from "./components/pages/Aprendizaje";
import Acerca from "./components/pages/Acerca.jsx";

import Desafio from "./components/pages/Juegos/Desafio.jsx";
import Deletreo from "./components/pages/Juegos/Deletreo";
import Camara from "./components/pages/Camara";
import Quiz from "./components/pages/Juegos/Quiz";
import Aprender from "./components/pages/Aprender";
import JuegosInteractivos from "./components/pages/Juegos.jsx";
import Memorama from "./components/pages/Juegos/Memorama.jsx";
import LeccionRoute from "./components/pages/Aprender/LeccionRoute.jsx";
import Infantil from "./components/pages/Infantil.jsx";
import RepasoABC from "./components/pages/Juegos/RepasoABC.jsx";
import SiNo from "./components/pages/Juegos/SiNo.jsx";
import LetraFalta from "./components/pages/Juegos/LetraFalta.jsx";
import RepasoLetras from "./components/pages/Aprender/RepasoLetras.jsx";
import Tutores from "./components/pages/Tutores.jsx";

import "./transitions.css";

// Layout A: Páginas Estándar (definido fuera para que React no lo remonte en cada render)
function MainLayout({ sidebarOpen, tutorialActivo, setSidebarOpen }) {
  const scrolled = useScrolled(80);
  const estrecha = useMediaQuery(CONSULTA_ESTRECHA);
  const showMenu = !sidebarOpen && !tutorialActivo;

  return (
    // El relleno escala con la ventana: 24px fijos son mucho en 600px de alto
    // y poco en un monitor grande. `min-h-0` deja que el hijo decida su alto
    // en vez de heredar el mínimo automático del flex.
    <div
      className="w-full max-w-7xl mx-auto flex-1 flex flex-col min-h-0"
      style={{ padding: "clamp(0.75rem, 1.6vw, 1.5rem)" }}
    >
      {showMenu && (
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label={tr("Abrir menú")}
          className="absolute top-4 left-8 z-50 bg-superficie text-texto
                     shadow-md rounded-md p-2 hover:bg-superficie-2
                     transition flex items-center justify-center"
        >
          <Menu size={22} strokeWidth={2.2} />
        </button>
      )}

      {showMenu && (
        <div className="absolute top-4 right-8 z-50 flex items-center gap-2">
          <IdiomaToggle />
          <ThemeToggle />
          <KidModeToggle />
        </div>
      )}

      {/* Barra fija con botón de menú cuando se hace scroll */}
      {showMenu && (
        <div
          className={`fixed top-0 right-0 z-30 flex items-center justify-between px-4 sm:px-8 py-3
            bg-fondo/80 backdrop-blur-md
            border-b border-borde
            transition-all duration-500 ease-out
            ${sidebarOpen && !estrecha ? "left-60" : "left-0"}
            ${scrolled ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"}`}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label={tr("Abrir menú")}
            className="bg-superficie text-texto
                       shadow-md rounded-md p-2 hover:bg-superficie-2
                       transition flex items-center justify-center"
          >
            <Menu size={22} strokeWidth={2.2} />
          </button>
          <div className="flex items-center gap-2">
            <IdiomaToggle />
            <ThemeToggle />
            <KidModeToggle />
          </div>
        </div>
      )}

      <Outlet />
    </div>
  );
}

// Layout B: Páginas Limpias
function CleanLayout() {
  return (
    <div className="flex-1 w-full flex flex-col">
      <Outlet />
    </div>
  );
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [tutorialActivo, setTutorialActivo] = useState(() => !leer("tourSignAICompleted"));
  const location = useLocation();
  const nodeRef = useRef(null);
  const { isDark } = useThemeContext();
  const prevDarkRef = useRef(isDark);
  const zoomTimersRef = useRef([]);

  useAutoCamara();
  const perfil = usePerfil();
  // Al cambiar de idioma se vuelve a montar el contenido: así hasta los textos
  // calculados una sola vez (listas, tutoriales) salen en el idioma nuevo.
  const { idioma } = useIdioma();

  // Por debajo de 1024 no sobran 240px: la barra lateral se superpone en vez
  // de empujar el contenido (ver `useMediaQuery`).
  const estrecha = useMediaQuery(CONSULTA_ESTRECHA);

  // Animación de zoom al cambiar de tema (reacciona al ThemeContext).
  useEffect(() => {
    if (prevDarkRef.current === isDark || animating) return;
    prevDarkRef.current = isDark;
    triggerAnimation();
  }, [isDark, animating]);

  // Los temporizadores del zoom tocan el DOM a mano: si la app se desmonta a
  // medias (recarga tras un error), dejarían clases de animación colgadas.
  useEffect(() => () => zoomTimersRef.current.forEach(clearTimeout), []);

  // Escape cierra el menú. Sin esto, con la barra superpuesta y el velo
  // delante, quien navega con teclado se queda sin salida.
  useEffect(() => {
    if (!sidebarOpen) return;
    const alPulsar = (e) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [sidebarOpen]);

  const triggerAnimation = () => {
    setAnimating(true);
    const wrapper = document.getElementById("app-wrapper");
    if (!wrapper) return setAnimating(false);
    wrapper.classList.add("theme-zoom-out");
    zoomTimersRef.current.push(
      setTimeout(() => {
        wrapper.classList.remove("theme-zoom-out");
        wrapper.classList.add("theme-zoom-in");
        zoomTimersRef.current.push(
          setTimeout(() => {
            wrapper.classList.remove("theme-zoom-in");
            setAnimating(false);
          }, 400)
        );
      }, 250)
    );
  };

  return (
    <div
      id="app-wrapper"
      className="h-screen w-full bg-fondo text-texto
                 transition-all duration-700 ease-in-out overflow-hidden flex"
    >
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* Velo del modo superpuesto. En una ventana estrecha la barra lateral
          no puede robarle 240px al contenido, así que se pone encima; el velo
          es lo que deja claro que hay algo abierto y da dónde pulsar para
          cerrarlo. */}
      {sidebarOpen && estrecha && (
        <div
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px]"
        />
      )}

      <div
        className={`flex-1 flex flex-col h-full min-w-0 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          sidebarOpen && !estrecha ? "ml-60" : "ml-0"
        }`}
      >
        <main key={idioma} className="flex-1 flex flex-col relative overflow-y-auto overflow-x-hidden scroll-smooth">
          <div className="flex-1 flex flex-col w-full">
            <TransitionGroup component={null}>
              <CSSTransition
                key={location.key}
                nodeRef={nodeRef}
                classNames="fade"
                timeout={300}
                unmountOnExit
              >
                <div ref={nodeRef} className="flex-1 flex flex-col w-full">
                  {/* Un fallo dentro de una pantalla no debe llevarse la app
                      entera: aquí se atrapa dejando en pie el marco (barra
                      lateral incluida), y `resetKey` limpia el error en cuanto
                      el usuario navega a otro sitio. */}
                  <ErrorBoundary resetKey={location.pathname}>
                  <Routes location={location}>
                    
                    <Route element={<MainLayout sidebarOpen={sidebarOpen} tutorialActivo={tutorialActivo} setSidebarOpen={setSidebarOpen} />}>
                      <Route path="/" element={<Home sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} onTutorialChange={setTutorialActivo} />} />
                      <Route path="/Ajustes" element={<Ajustes sidebarOpen={sidebarOpen} />} />
                      <Route path="/Aprendizaje" element={<Aprendizaje sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />} />
                      <Route path="/Acerca" element={<Acerca sidebarOpen={sidebarOpen} />} />
                    </Route>

                    <Route element={<CleanLayout />}>
                      <Route path="/Deletreo" element={<Deletreo sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />} />
                      <Route path="/Desafio" element={<Desafio sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />} />
                      <Route path="/Camara" element={<Camara setSidebarOpen={setSidebarOpen} />} />
                      <Route path="/Aprender/:categoria" element={<LeccionRoute sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />} />
                      <Route path="/Memorama" element={<Memorama sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />} />
                      <Route path="/Juegos" element={<JuegosInteractivos sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />} />
                      <Route path="/Aprender" element={<Aprender sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />} />
                      <Route path="/Quiz" element={<Quiz sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />} />
                      <Route path="/SiNo" element={<SiNo setSidebarOpen={setSidebarOpen} />} />
                      <Route path="/LetraFalta" element={<LetraFalta setSidebarOpen={setSidebarOpen} />} />
                      <Route path="/Infantil" element={<Infantil sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />} />
                      <Route path="/RepasoABC" element={<RepasoABC sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />} />
                      <Route path="/RepasoLetras" element={<RepasoLetras sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />} />
                      <Route path="/Tutores" element={<Tutores setSidebarOpen={setSidebarOpen} />} />
                    </Route>

                    {/* Cualquier ruta desconocida (hash mal escrito, enlace
                        viejo) volvía una pantalla en blanco sin salida. */}
                    <Route path="*" element={<Navigate to="/" replace />} />

                  </Routes>
                  </ErrorBoundary>
                </div>
              </CSSTransition>
            </TransitionGroup>
          </div>
        </main>
      </div>

      {/* Primera vez (o tras "Volver a escribir mi nombre" en Ajustes). */}
      {!perfil && <Bienvenida />}
    </div>
  );
}