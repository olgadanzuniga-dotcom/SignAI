import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { guardar } from "../utils/almacen";

// Fuente única de verdad del tema. main.jsx aplica la clase "dark" en <html>
// antes del primer render (para evitar el flash); a partir de ahí este
// contexto es el único que toca esa clase y localStorage ("lsm_theme").
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light"
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Solo se persiste cuando el usuario elige explícitamente; si nunca eligió,
  // la app sigue respetando el tema del sistema en el próximo arranque.
  const setTheme = useCallback((t) => {
    setThemeState(t);
    guardar("lsm_theme", t);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === "dark", setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeContext debe usarse dentro de <ThemeProvider>");
  return ctx;
}
