import { describe, it, expect } from "vitest";
import { componer } from "../../src/hooks/useTranscripcion";
import { esLetra } from "../../src/data/palabras";

// El traductor va escribiendo un mensaje con cada seña confirmada. La regla no
// es obvia: las LETRAS se pegan entre si (de eso va el deletreo, A+G+U+A da
// "AGUA") pero las PALABRAS son unidades cerradas y nunca se pegan a lo que
// tengan al lado, o "HOLA" seguido de "A" se leeria "HOLAA".
const entrada = (v) => ({ valor: v, tipo: esLetra(v) ? "letra" : "palabra" });
const ESPACIO = { valor: " ", tipo: "espacio" };
const seq = (...xs) => componer(xs.map((x) => (x === " " ? ESPACIO : entrada(x))));

describe("componer", () => {
  const casos = [
    [["A", "G", "U", "A"], "AGUA", "deletreo: las letras se encadenan"],
    [["HOLA"], "HOLA", "una palabra sola"],
    [["HOLA", "A"], "HOLA A", "letra tras palabra NO se pega"],
    [["A", "HOLA"], "A HOLA", "palabra tras letra NO se pega"],
    [["HOLA", "PERRO"], "HOLA PERRO", "dos palabras seguidas"],
    [["A", " ", "B"], "A B", "el espacio manual separa letras"],
    [["R", "R"], "RR", "dos R seguidas (no es la seña RR)"],
    [["RR"], "RR", "la seña RR es una letra"],
    [["Ñ", "O"], "ÑO", "la Ñ es letra y se encadena"],
    [["HOLA", " ", "A", "G", "U", "A"], "HOLA AGUA", "frase real deletreando"],
    [[], "", "sin entradas"],
  ];

  for (const [entradas, esperado, desc] of casos) {
    it(desc, () => {
      expect(seq(...entradas)).toBe(esperado);
    });
  }

  // El caso que motivo la funcion: antes cada seña se pronunciaba y se perdia,
  // asi que deletrear A-G-U-A sonaba "a, ge, u, a" y nadie llegaba a leer AGUA.
  it("la secuencia HOLA A G U A PERRO se lee HOLA AGUA PERRO", () => {
    expect(seq("HOLA", "A", "G", "U", "A", "PERRO")).toBe("HOLA AGUA PERRO");
  });
});

describe("esLetra", () => {
  it("reconoce el alfabeto completo, incluidas Ñ y RR", () => {
    for (const l of [..."ABCDEFGHIJKLMNOPQRSTUVWXYZÑ", "RR"]) {
      expect(esLetra(l), l).toBe(true);
    }
  });

  it("las palabras del vocabulario no son letras", () => {
    for (const p of ["AGUA", "HOLA", "PERRO"]) {
      expect(esLetra(p), p).toBe(false);
    }
  });

  it("una clase nueva del modelo se trata como palabra sin tocar codigo", () => {
    // El alfabeto es cerrado y el vocabulario abierto: por eso esLetra define
    // el alfabeto y no la lista de palabras.
    expect(esLetra("GRACIAS")).toBe(false);
  });

  it("no revienta con valores vacios", () => {
    expect(esLetra("")).toBe(false);
    expect(esLetra(null)).toBe(false);
    expect(esLetra(undefined)).toBe(false);
  });

  it("es indiferente a mayusculas", () => {
    expect(esLetra("a")).toBe(true);
    expect(esLetra("rr")).toBe(true);
  });
});
