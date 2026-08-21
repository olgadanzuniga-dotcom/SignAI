// Baraja un array con Fisher-Yates y devuelve una copia nueva.
// (El clásico `.sort(() => Math.random() - 0.5)` produce mezclas sesgadas.)
export function barajar(array) {
  const copia = [...array];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}
