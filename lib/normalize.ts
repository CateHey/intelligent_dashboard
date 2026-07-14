// Normaliza la pregunta para la caché: minúsculas, sin acentos, sin signos,
// espacios colapsados. "¿Jobs por Técnico?" -> "jobs por tecnico".
export function normalize(question: string): string {
  return question
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "") // quita acentos (marcas combinantes Unicode)
    .replace(/[^\w\s]/g, " ") // quita signos de puntuación
    .replace(/\s+/g, " ")
    .trim();
}
