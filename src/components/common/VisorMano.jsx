import React, { Suspense, useCallback, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Center } from "@react-three/drei";
import { Hand } from "lucide-react";
import ErrorBoundary from "./ErrorBoundary";

/**
 * Visor 3D de la mano, aislado del resto de la lección.
 *
 * Aquí vive **todo lo que puede fallar sin que la lección deje de servir**:
 * que no haya WebGL (equipo sin GPU utilizable, escritorio remoto), que el
 * driver pierda el contexto, o que el `.glb` no se pueda cargar. Antes
 * cualquiera de esas tres cosas lanzaba durante el render y tumbaba la app
 * entera; ahora se degrada a una caja con un icono y la lección — que es lo
 * que enseña la seña — sigue en pie.
 *
 * ## La ruta del modelo
 *
 * Iba escrita como `/Mano.glb`. En desarrollo funciona porque Vite sirve
 * `public/` desde la raíz del servidor, pero **la app instalada se carga con
 * `file://`**, y ahí una ruta absoluta apunta a la raíz del disco:
 * `C:\Mano.glb`. O sea que el modelo no cargaba en ni una sola copia
 * instalada, y como `useGLTF` lanza al fallar, la lección de abecedario
 * reventaba. `BASE_URL` lleva el prefijo con que se compiló (`/` en
 * desarrollo, `./` en la compilación, ver `base` en vite.config.js), que sí
 * resuelve contra `dist/index.html`.
 */
export const RUTA_MANO = `${import.meta.env.BASE_URL}Mano.glb`;

function ModeloMano({ modeloPath }) {
  const { scene } = useGLTF(modeloPath);
  return (
    <Center>
      <primitive object={scene} scale={0.07} />
    </Center>
  );
}

function Cargando() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-acento border-t-transparent" />
    </div>
  );
}

function SinVista3D({ motivo }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
      <Hand className="h-10 w-10 text-sutil" strokeWidth={1.6} />
      <p className="text-sm font-medium text-sutil">Vista 3D no disponible</p>
      <p className="max-w-[22ch] text-xs text-sutil/80">{motivo}</p>
    </div>
  );
}

export default function VisorMano({ modeloPath = RUTA_MANO }) {
  const [contextoPerdido, setContextoPerdido] = useState(false);

  // El driver puede tirar el contexto WebGL (suspensión, cambio de GPU,
  // escritorio remoto). Sin esto la caja se queda en negro sin explicación.
  const alCrear = useCallback(({ gl }) => {
    const lienzo = gl.domElement;
    lienzo.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      setContextoPerdido(true);
    });
    lienzo.addEventListener("webglcontextrestored", () => setContextoPerdido(false));
  }, []);

  if (contextoPerdido) {
    return <SinVista3D motivo="Se perdió la aceleración por hardware. Vuelve a entrar a la lección." />;
  }

  return (
    <ErrorBoundary
      resetKey={modeloPath}
      fallback={() => (
        <SinVista3D motivo="Este equipo no pudo dibujar el modelo. La lección funciona igual." />
      )}
    >
      <Suspense fallback={<Cargando />}>
        <Canvas camera={{ position: [0, 0, 25], fov: 25 }} onCreated={alCrear}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[10, 10, 5]} intensity={1.2} />
          <directionalLight position={[-10, -10, -5]} intensity={0.4} />
          <ModeloMano modeloPath={modeloPath} />
          <OrbitControls enableZoom />
        </Canvas>
      </Suspense>
    </ErrorBoundary>
  );
}
