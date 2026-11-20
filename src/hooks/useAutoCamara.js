import { useEffect } from "react";
import { HTTP } from "../utils/signServer";
import { guardar, leer } from "../utils/almacen";

// Una version anterior de este hook preferia automaticamente la ULTIMA
// camara detectada (tipicamente la externa) cuando no habia preferencia
// guardada. Se revirtio: el modelo de senias se entreno solo con la camara
// integrada (indice 0, ver grabar_estatica.py / grabar_dinamica.py /
// SignAI.py), asi que reconocia peor con cualquier otra. Esto deshace, una
// sola vez, la preferencia que esa version pudo haber guardado sola.
const MIGRACION_KEY = "signai_camara_reset_v1";

// El motor siempre arranca escuchando en el indice de camara por defecto (la
// integrada), y antes el usuario tenia que entrar a Ajustes y elegir la otra
// a mano cada vez que abria la app. Esto corre una sola vez al abrir la app
// y reaplica la preferencia guardada (si existe) sin que haga falta volver a
// elegirla. Sin preferencia guardada, se deja el indice por defecto del
// motor (la integrada), que es con la que esta entrenado el modelo.
export default function useAutoCamara() {
  useEffect(() => {
    if (leer(MIGRACION_KEY) !== "hecho") {
      guardar(MIGRACION_KEY, "hecho");
      if (leer("camara_lsm", "") !== "") guardar("camara_lsm", "0");
    }

    let cancelado = false;
    (async () => {
      try {
        const guardada = leer("camara_lsm", "");
        if (guardada === "") return; // sin preferencia: se queda en la integrada

        const r = await fetch(`${HTTP}/camaras`);
        const data = await r.json();
        if (cancelado || !Array.isArray(data.camaras)) return;

        const preferida = Number(guardada);
        const existe = data.camaras.some((c) => c.indice === preferida);
        if (existe && preferida !== data.actual) {
          await fetch(`${HTTP}/camara?indice=${preferida}`, { method: "POST" });
        }
      } catch (err) {
        console.warn("No se pudo preparar la cámara automáticamente:", err);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);
}
