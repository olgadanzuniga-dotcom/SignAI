import { describe, it, expect } from "vitest";
import { barajar } from "../../src/utils/aleatorio";

// barajar() lo usan Quiz, Memorama y Deletreo. Dos propiedades importan de
// verdad: que NO toque el array de entrada (varios componentes barajan datos
// que viven en modulo, compartidos entre partidas) y que no pierda elementos.

describe("barajar", () => {
  it("devuelve los mismos elementos", () => {
    const original = ["A", "B", "C", "D", "E"];
    expect([...barajar(original)].sort()).toEqual([...original].sort());
  });

  it("no muta el array de entrada", () => {
    const original = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const copia = [...original];
    for (let i = 0; i < 50; i++) barajar(original);
    expect(original).toEqual(copia);
  });

  it("devuelve un array distinto del de entrada", () => {
    const original = [1, 2, 3];
    expect(barajar(original)).not.toBe(original);
  });

  it("aguanta los casos limite", () => {
    expect(barajar([])).toEqual([]);
    expect(barajar(["solo"])).toEqual(["solo"]);
  });

  it("reparte de verdad, no deja todo en su sitio", () => {
    // Fisher-Yates bien hecho mueve las cosas. Con 8 elementos y 100 pasadas,
    // que ninguna cambie el orden seria imposible por casualidad
    // (la probabilidad de acertar el orden original es 1/40320 por pasada).
    const original = [1, 2, 3, 4, 5, 6, 7, 8];
    const distintas = Array.from({ length: 100 }, () => barajar(original))
      .filter((r) => r.join() !== original.join()).length;
    expect(distintas).toBeGreaterThan(90);
  });

  it("no favorece ninguna posicion (el sesgo del sort() aleatorio)", () => {
    // El clasico `.sort(() => Math.random() - 0.5)` deja el primer elemento
    // cerca de su sitio mucho mas a menudo de lo que deberia. Con un barajado
    // uniforme, el elemento 0 acaba en cada una de las 5 posiciones ~20% de
    // las veces; se acepta 12%-30% para que el test no sea inestable.
    const N = 5, VUELTAS = 4000;
    const cuenta = new Array(N).fill(0);
    for (let i = 0; i < VUELTAS; i++) {
      cuenta[barajar([0, 1, 2, 3, 4]).indexOf(0)]++;
    }
    for (const [pos, veces] of cuenta.entries()) {
      const pct = (veces / VUELTAS) * 100;
      expect(pct, `posicion ${pos}: ${pct.toFixed(1)}%`).toBeGreaterThan(12);
      expect(pct, `posicion ${pos}: ${pct.toFixed(1)}%`).toBeLessThan(30);
    }
  });
});
