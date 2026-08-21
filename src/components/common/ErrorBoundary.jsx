import React from "react";

/**
 * Red de seguridad para errores de render.
 *
 * En Electron no hay barra de direcciones ni recarga a mano: si un componente
 * lanza durante el render, React desmonta todo el árbol y al usuario le queda
 * una ventana en blanco sin salida. Aquí se atrapa y se ofrece volver al inicio.
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

  handleVolver = () => {
    // HashRouter: basta con reponer el hash y recargar para partir de cero.
    window.location.hash = "#/";
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen w-full flex items-center justify-center p-6 bg-fondo text-texto">
        <div className="max-w-lg w-full bg-superficie rounded-3xl shadow-xl border border-borde p-8 text-center">
          <h1 className="text-2xl font-extrabold mb-3">Algo salió mal</h1>
          <p className="text-sutil mb-6">
            Ocurrió un error inesperado en esta pantalla. Puedes volver al inicio
            y continuar; el resto de la aplicación sigue funcionando.
          </p>
          <pre className="text-left text-xs bg-superficie-2 rounded-xl p-3 mb-6 overflow-x-auto text-error">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button
            onClick={this.handleVolver}
            className="bg-acento hover:bg-acento-fuerte text-acento-texto px-8 py-3 rounded-xl font-bold shadow-lg transition"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }
}
