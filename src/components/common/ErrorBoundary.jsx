import React from "react";
import { tr } from "../../i18n";

/**
 * Red de seguridad para errores de render.
 *
 * En Electron no hay barra de direcciones ni recarga a mano: si un componente
 * lanza durante el render, React desmonta todo el árbol y al usuario le queda
 * una ventana en blanco sin salida.
 *
 * Se usa en **dos niveles**, y el de dentro es el que importa:
 *
 * - `main.jsx` envuelve la app entera: último recurso, pantalla completa.
 * - `App.jsx` envuelve solo el contenido de la ruta, con `resetKey={ruta}`.
 *   Sin ese segundo nivel, un fallo en una pantalla se llevaba por delante
 *   el árbol completo — barra lateral incluida — y como el estado de error
 *   nunca se limpiaba, **todas** las pantallas siguientes mostraban «Algo
 *   salió mal» hasta reiniciar la app. Con `resetKey`, salir de la pantalla
 *   rota basta para recuperarse.
 *
 * `fallback` permite una caja a medida (p. ej. el visor 3D, que puede fallar
 * sin que la lección deje de servir). Recibe `(error, reintentar)`.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[SignAI] error de render:", error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    // Cambiar de pantalla limpia el error: lo que reventó ya no está montado.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  reintentar = () => this.setState({ error: null });

  handleVolver = () => {
    // HashRouter: basta con reponer el hash y recargar para partir de cero.
    window.location.hash = "#/";
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reintentar);

    return (
      <div className="flex min-h-0 w-full flex-1 items-center justify-center bg-fondo p-6 text-texto">
        <div className="w-full max-w-lg rounded-3xl border border-borde bg-superficie p-8 text-center shadow-xl">
          <h1 className="mb-3 text-2xl font-extrabold">{tr("Algo salió mal")}</h1>
          <p className="mb-6 text-sutil">{tr("Ocurrió un error inesperado en esta pantalla. Puedes reintentar o volver al inicio; el resto de la aplicación sigue funcionando.")}</p>
          <pre className="mb-6 overflow-x-auto rounded-xl bg-superficie-2 p-3 text-left text-xs text-error">
            {String(error?.message || error)}
          </pre>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <button
              onClick={this.reintentar}
              className="rounded-xl bg-acento-suave px-6 py-3 font-bold text-acento transition hover:bg-superficie-2"
            >{tr("Reintentar")}</button>
            <button
              onClick={this.handleVolver}
              className="rounded-xl bg-acento px-8 py-3 font-bold text-acento-texto shadow-lg transition hover:bg-acento-fuerte"
            >{tr("Volver al inicio")}</button>
          </div>
        </div>
      </div>
    );
  }
}
