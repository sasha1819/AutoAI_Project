/**
 * "1 file", "3 files". The scan screen's one copy (Add project and the CLI have their own: features cannot import
 * each other and screens cannot import patterns/_format; a shared home is a recorded follow-up).
 */
export const plural = (n: number, word: string): string =>
  `${String(n)} ${word}${n === 1 ? "" : "s"}`;
