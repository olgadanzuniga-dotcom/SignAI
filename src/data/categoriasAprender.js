// ============================================================
// Palabras de cada categoría de "Aprender"
// ------------------------------------------------------------
// Para AGREGAR, QUITAR o REEMPLAZAR una palabra: solo edita
// la lista correspondiente. El resto de la app se actualiza sola.
// ============================================================

const aItems = (labels) =>
  labels.map((label, i) => ({ id: `${label}-${i}`, label }));

// Abecedario LSM completo. No es "A-Z" a secas: la Ñ y la RR son letras
// propias del alfabeto, y ademas son señas que el modelo dinamico YA sabe
// validar (senasDinamicas en data/palabras.js), asi que dejarlas fuera
// escondia dos letras que el alumno podia practicar de verdad con la camara.
// El orden es el del alfabeto español: la Ñ va tras la N y la RR tras la R.
// Lo vigila pruebas/unit/datos.test.js contra letrasLSM.
export const abecedario = aItems([
  ..."ABCDEFGHIJKLMN".split(""),
  "Ñ",
  ..."OPQR".split(""),
  "RR",
  ..."STUVWXYZ".split(""),
]);

// Números
export const numeros = aItems([
  "0", "1", "2", "3", "4", "5",
  "6", "7", "8", "9", "10",
]);

// Colores
export const colores = aItems([
  "Rojo",
  "Azul",
  "Verde",
  "Amarillo",
  "Negro",
  "Blanco",
  "Café",
  "Rosa",
  "Morado",
  "Naranja",
]);

// Presentaciones personales
export const presentaciones = aItems([
  "Me llamo",
  "¿Cómo te llamas?",
  "Mucho gusto",
  "Soy de",
  "Tengo … años",
  "Yo",
  "Tú",
  "Él / Ella",
]);

// Saludos y despedidas
export const saludos = aItems([
  "Hola",
  "Buenos días",
  "Buenas tardes",
  "Buenas noches",
  "Adiós",
  "Hasta luego",
  "Hasta mañana",
  "Nos vemos",
]);

// Días y tiempo
export const dias = aItems([
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
  "Hoy",
  "Mañana",
  "Ayer",
]);

// Comida y bebidas
export const comida = aItems([
  "Agua",
  "Leche",
  "Café",
  "Refresco",
  "Pan",
  "Tortilla",
  "Tacos",
  "Fruta",
  "Huevo",
  "Sopa",
]);

// Lugares
export const lugares = aItems([
  "Casa",
  "Escuela",
  "Hospital",
  "Tienda",
  "Parque",
  "Iglesia",
  "Banco",
  "Restaurante",
  "Biblioteca",
  "Mercado",
]);

// Transporte y direcciones
export const transporte = aItems([
  "Carro",
  "Autobús",
  "Bicicleta",
  "Motocicleta",
  "Tren",
  "Avión",
  "Norte",
  "Sur",
  "Este",
  "Oeste",
  "Izquierda",
  "Derecha",
]);
