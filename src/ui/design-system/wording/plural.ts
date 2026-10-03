/** "1 file", "3 files": a count with its word. The screens' one copy (the terminal command keeps its own). */
export function plural(n: number, word: string): string {
  return `${String(n)} ${word}${n === 1 ? "" : "s"}`;
}
