import { useEffect } from "react";

// Cierra el sidebar al montar la pantalla (juegos y vistas a pantalla completa).
export default function useCerrarSidebar(setSidebarOpen) {
  useEffect(() => {
    if (typeof setSidebarOpen === "function") setSidebarOpen(false);
  }, [setSidebarOpen]);
}
