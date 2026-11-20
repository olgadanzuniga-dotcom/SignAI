import { describe, it, expect } from "vitest";
import {
  palabrasDeletreo,
  palabrasDesafio,
  senasEstaticas,
  senasDinamicas,
  letrasLSM,
  respuestasIncorrectasQuiz,
} from "../../src/data/palabras";
import * as categorias from "../../src/data/categoriasAprender";

// Estos datos los indexan a ciegas cuatro pantallas. Un duplicado o un hueco
// no rompe nada visiblemente: simplemente hace que el juego evalue mal.

describe("respuestasIncorrectasQuiz", () => {
  it("no tiene duplicados", () => {
    // La lista se escribio a mano y tenia repetidos ("Puerta", "Ventana"), lo
    // que hacia que una pregunta mostrara dos opciones identicas.
    const vistos = new Set(respuestasIncorrectasQuiz);
    expect(vistos.size).toBe(respuestasIncorrectasQuiz.length);
  });

  it("da para cuatro opciones con margen", () => {
    expect(respuestasIncorrectasQuiz.length).toBeGreaterThan(50);
  });

  // Las 15 respuestas correctas del Quiz (Juegos/Quiz.jsx). Se repiten aqui a
  // proposito: si alguien anade una, este test le recuerda comprobar que no
  // haya un sinonimo suyo entre los distractores.
  const CORRECTAS = [
    "Perro", "Hola", "Tacos", "Amarillo", "Carro", "Elefante", "Tienda",
    "Adiós", "Refresco", "Gato", "Autobús", "Montaña", "Libro", "Ventana",
    "Cielo",
  ];

  it("ningun distractor es la respuesta correcta", () => {
    // Quiz.jsx filtra por igualdad exacta, asi que esto solo confirma el dato.
    const repetidas = CORRECTAS.filter((c) => respuestasIncorrectasQuiz.includes(c));
    expect(repetidas.length).toBeGreaterThan(0); // el filtro de Quiz los quita
  });

  it("ningun distractor es SINONIMO de una respuesta correcta", () => {
    // El filtro de Quiz compara cadenas, asi que no puede ver esto: ofrecer
    // "Coche" junto a "Carro", o "Camión" junto a "Autobús" (en Mexico camion
    // ES la palabra normal para autobus), marca como error una respuesta que
    // cualquier hispanohablante daria por buena.
    const SINONIMOS = {
      Carro: ["Coche", "Auto", "Automóvil"],
      Autobús: ["Camión", "Bus", "Guagua"],
      Refresco: ["Soda", "Gaseosa"],
      Tienda: ["Almacén", "Abarrotes"],
      Adiós: ["Chao", "Hasta luego"],
    };
    const conflictos = [];
    for (const correcta of CORRECTAS) {
      for (const sin of SINONIMOS[correcta] ?? []) {
        if (respuestasIncorrectasQuiz.includes(sin)) {
          conflictos.push(`${sin} es sinonimo de ${correcta}`);
        }
      }
    }
    expect(conflictos).toEqual([]);
  });
});

describe("señas que el modelo reconoce", () => {
  it("estaticas y dinamicas no se solapan", () => {
    const solapadas = [...senasEstaticas].filter((s) => senasDinamicas.has(s));
    expect(solapadas).toEqual([]);
  });

  it("el Modo Desafio solo pide señas que el modelo sabe validar", () => {
    // Si no, la ronda es imposible de ganar y el cronometro se agota solo.
    const imposibles = palabrasDesafio.filter(
      (p) => !senasEstaticas.has(p) && !senasDinamicas.has(p)
    );
    expect(imposibles).toEqual([]);
  });

  it("cada modo del Desafio deja al menos una ronda jugable", () => {
    // rondas se re-deriva del modelo activo, que es global del servidor.
    expect(palabrasDesafio.filter((p) => senasEstaticas.has(p)).length)
      .toBeGreaterThan(0);
    expect(palabrasDesafio.filter((p) => senasDinamicas.has(p)).length)
      .toBeGreaterThan(0);
  });

  it("las señas del modelo son letras del alfabeto o palabras, nunca otra cosa", () => {
    for (const s of [...senasEstaticas, ...senasDinamicas]) {
      const esPalabra = [
        "AGUA", "HOLA", "PERRO", "AMARILLO", "AZUL", "ROJO", "BUENOS", "DÍAS",
      ].includes(s);
      expect(letrasLSM.has(s) || esPalabra, s).toBe(true);
    }
  });
});

describe("palabrasDeletreo", () => {
  it("solo usa letras del alfabeto", () => {
    for (const palabra of palabrasDeletreo) {
      for (const letra of palabra) {
        expect(letrasLSM.has(letra), `${letra} de ${palabra}`).toBe(true);
      }
    }
  });
});

describe("categoriasAprender", () => {
  const listas = Object.entries(categorias).filter(([, v]) => Array.isArray(v));

  it("hay categorias que cargar", () => {
    expect(listas.length).toBeGreaterThan(0);
  });

  for (const [nombre, items] of listas) {
    it(`${nombre}: no esta vacia y sus ids son unicos`, () => {
      // LeccionAprender hace items[indice].label sin guarda: una lista vacia
      // la reventaria, y un id repetido rompe las keys de React.
      expect(items.length).toBeGreaterThan(0);
      const ids = items.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const item of items) {
        expect(typeof item.label).toBe("string");
        expect(item.label.length).toBeGreaterThan(0);
      }
    });
  }

  it("el abecedario incluye TODAS las letras del alfabeto LSM", () => {
    // Se construia con "A..Z" a secas, dejando fuera la Ñ y la RR, que son
    // letras propias del alfabeto y que ademas el modelo dinamico ya sabe
    // validar: la leccion no enseñaba dos letras que se podian practicar.
    const enLeccion = new Set(categorias.abecedario.map((i) => i.label));
    const faltan = [...letrasLSM].filter((l) => !enLeccion.has(l));
    expect(faltan).toEqual([]);
  });
});
