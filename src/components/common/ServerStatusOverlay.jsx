import React from "react";
import { WifiOff, CameraOff } from "lucide-react";
import { useIdioma } from "../../i18n";

// Overlay mientras se conecta con el servidor de inferencia.
//
// Sus colores (blanco, rojo claro, velo negro) van fijos y NO son tokens: esto
// se dibuja siempre sobre el hueco de la cámara, nunca sobre el fondo de la
// app. Si siguiera al tema claro dejaría de leerse encima del vídeo.
//
//  - `engineError`: el motor responde pero no puede trabajar (p. ej. no logra
//    abrir la cámara). Es el caso más común en un equipo ajeno, así que se
//    muestra primero y con instrucciones concretas.
//  - `serverDown`: varios reintentos fallidos seguidos (ver useSignServer);
//    se sigue reintentando detrás.
export default function ServerStatusOverlay({
  serverDown = false,
  engineError = "",
  className = "absolute inset-0 flex items-center justify-center bg-black/60 z-40",
  boxClassName = "text-center text-white space-y-3",
}) {
  const { t } = useIdioma();
  if (engineError) {
    return (
      <div className={className}>
        <div className={`${boxClassName} max-w-sm px-6`}>
          <CameraOff className="mx-auto h-9 w-9 text-red-400" />
          <p className="text-sm leading-relaxed font-semibold">{t(engineError)}</p>
          <p className="text-xs text-white/60 leading-relaxed">
            {t("Revisa que la cámara esté conectada, que ningún otro programa (Zoom, Teams, Meet) la esté usando y que SignAI tenga permiso en Configuración de Windows › Privacidad › Cámara.")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className={boxClassName}>
        {serverDown ? (
          <>
            <WifiOff className="mx-auto h-9 w-9 text-red-400" />
            <p className="text-sm leading-relaxed font-semibold">
              {t("No se pudo conectar con el motor de traducción.")}
            </p>
            <p className="text-xs text-white/60">
              {t("Cierra SignAI por completo y vuelve a abrirlo. Seguiremos reintentando automáticamente.")}
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto animate-spin rounded-full h-9 w-9 border-4 border-white/30 border-t-white" />
            <p className="text-sm leading-relaxed">
              {t("Conectando con el motor de traducción…")}
            </p>
            <p className="text-xs text-white/60">
              {t("La primera vez puede tardar unos segundos.")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
