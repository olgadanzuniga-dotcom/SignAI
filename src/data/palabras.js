export const palabrasDeletreo = ["AGUA", "MESA", "GATO", "CARRO"];

// Señas que los modelos reconocen hoy (ver modelos/*/label_map.json):
// estáticas = letras sin movimiento; dinámicas = palabras y letras con
// movimiento. El modelo "unificado" reconoce ambas.
export const senasEstaticas = new Set("ABCDEFGHILMNOPRSTUVWY".split(""));
export const senasDinamicas = new Set([
  "AGUA", "HOLA", "PERRO", "J", "Q", "RR", "X", "Z", "Ñ",
  // Agregadas sin reentrenar (senas_nuevas.py en el servidor).
  "AMARILLO", "AZUL", "ROJO", "BUENOS", "DÍAS",
]);

// Alfabeto LSM completo. Se define el alfabeto (cerrado) y no la lista de
// palabras (abierta): así, al ampliar el vocabulario del modelo, las clases
// nuevas se reconocen como palabras sin tocar este archivo.
// Incluye la K aunque todavía no esté entrenada, y RR y Ñ, que son letras
// propias del alfabeto aunque RR ocupe dos caracteres.
export const letrasLSM = new Set([
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZÑ".split(""),
  "RR",
]);

// El traductor lo usa para decidir cómo encadenar cada seña confirmada: las
// letras se pegan entre sí (deletreo) y las palabras van como token aparte.
export const esLetra = (sena) => letrasLSM.has(String(sena || "").toUpperCase());

// Rondas del Modo Desafío: solo señas que el modelo puede validar en vivo
// (mezcla de palabras dinámicas y letras estáticas).
export const palabrasDesafio = [
  "HOLA", "B", "AGUA", "L", "PERRO",
  "V", "U", "W", "R", "Y",
];

// Distractores del Quiz. Se deduplican al exportar: la lista se escribió a
// mano y tenía repetidos ("Puerta", "Ventana"), lo que hacía que una misma
// pregunta pudiera mostrar dos opciones idénticas.
//
// Tampoco puede haber SINÓNIMOS de una respuesta correcta. Quiz.jsx filtra
// por igualdad exacta, así que no los ve: ofrecer "Coche" junto a "Carro", o
// "Camión" junto a "Autobús" (en México camión ES la palabra normal para
// autobús), marcaba como error una respuesta que cualquier hispanohablante
// daría por buena. Lo vigila pruebas/unit/datos.test.js.
const distractoresQuiz = [
  "Montaña","Libro","Ventana","Cielo","Computadora","Playa","Sombrero","Zapato","Árbol","Río",
  "Teléfono","Escuela","Fuego","Nube","Camisa","Lámpara","Silla","Mesa","Reloj","Puerta",
  "Bicicleta","Chocolate","Pelota","Jardín","Estrella","Café","Música","Martillo","Avión","Hospital",
  "Ciudad","Isla","Tren","Dinero","Llave","Espejo","Mochila","Ratón","Cuaderno","Luna",
  "Sol","Flor","Banco","Pan","Agua","Naranja","Calle","Globo","Pintura",
  "Carpeta","Ventilador","Escalera","Corazón","Botella","Cama","Almohada","Toalla","Cocina","Plato",
  "Cuchara","Tenedor","Radio","Televisión","Doctor","Policía","Parque","Tierra","Arena","Mar",
  "Hielo","Nieve","Papel","Tijeras","Guitarra","Zapatería","Biblioteca","Teatro","Museo","Restaurante",
  "Pastel","Helado","Fresa","Limón","Toro","Caballo","León","Tigre","Serpiente","Tortuga",
  "Lápiz","Calculadora","Autobús","Semáforo","Puente","Castillo","Molino","Cohete","Mapa",
  "Puerta","Escudo","Bandera","Campana","Tambor","Flauta","Violín","Piano","Teclado","Monitor",
  "Impresora","Cable","Router","Servidor","Pantalla","Auricular","Micrófono","Batería","Motor","Rueda",
  "Ventana","Tejado","Pared","Piso","Techo","Columna","Pasillo","Jardinería","Huerto","Semilla",
  "Trigo","Maíz","Arroz","Frijol","Lenteja","Tomate","Cebolla","Papa","Zanahoria","Pepino",
  "Lechuga","Espinaca","Manzana","Pera","Durazno","Mango","Piña","Sandía","Melón","Cereza",
  "Ciruela","Granada","Coco","Almendra","Nuez","Avellana","Miel","Azúcar","Sal","Pimienta",
  "Canela","Vainilla","Aceite","Vinagre","Queso","Yogur","Mantequilla","Crema","Sopa","Ensalada",
  "Sandwich","Tostada","Galleta","Panadería","Pastelería","Cafetería","Mercado","Farmacia","Gasolinera","Hotel",
  "Hostal","Aeropuerto","Terminal","Puerto","Carretera","Autopista","Sendero","Montículo","Pradera","Bosque",
  "Selva","Desierto","Volcán","Lago","Laguna","Cascada","Acantilado","Valle","Cueva","Islote",
];

export const respuestasIncorrectasQuiz = [...new Set(distractoresQuiz)];
