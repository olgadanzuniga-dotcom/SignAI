import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import ScrollToTop from "./components/ScrollToTop";
import ErrorBoundary from "./components/common/ErrorBoundary";
import { ThemeProvider } from "./context/ThemeContext";
import { leer } from "./utils/almacen";
import "@fontsource-variable/fredoka/index.css";
import "./index.css";

// Todo lo que se escapa del render de React acaba aquí. En Electron no hay
// consola a la vista para el usuario, pero sí en `npm run dev` y en los
// sondeos de pruebas/ui: sin esto, un fallo asíncrono (una promesa rechazada
// en un hook, un recurso que no carga) se perdía sin dejar rastro.
window.addEventListener("error", (e) => {
  console.error("[SignAI] error no atrapado:", e.message, `${e.filename}:${e.lineno}`);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("[SignAI] promesa rechazada sin atrapar:", e.reason);
});

// Aplica el tema guardado ANTES de que React renderice algo
const savedTheme = leer("lsm_theme");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

// Si el usuario nunca eligió tema, respeta el del sistema
const theme = savedTheme || (prefersDark ? "dark" : "light");

if (theme === "dark") {
  document.documentElement.classList.add("dark");
} else {
  document.documentElement.classList.remove("dark");
}

// Aplica el modo infantil guardado ANTES de que React renderice algo, igual
// que el tema: sin esto la portada se veía un instante en modo normal y
// saltaba al modo infantil apenas montaba <Home>.
if (leer("lsm_kid_mode") === "true") {
  document.documentElement.classList.add("kid-mode");
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <ThemeProvider>
        <ScrollToTop />
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </ThemeProvider>
    </HashRouter>
  </React.StrictMode>
);
