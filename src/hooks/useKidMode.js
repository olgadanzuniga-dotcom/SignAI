import { useEffect, useState } from "react";

const STORAGE_KEY = "lsm_kid_mode";

export function applyKidMode(enabled) {
  document.documentElement.classList.toggle("kid-mode", enabled);
  localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
}

export function toggleKidMode() {
  const enabled = document.documentElement.classList.contains("kid-mode");
  applyKidMode(!enabled);
}

export default function useKidMode() {
  const [kidMode, setKidMode] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("kid-mode")
  );

  useEffect(() => {
    const el = document.documentElement;
    const update = () => setKidMode(el.classList.contains("kid-mode"));
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === "class") {
          update();
          return;
        }
      }
    });
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    update();
    return () => observer.disconnect();
  }, []);

  return kidMode;
}
