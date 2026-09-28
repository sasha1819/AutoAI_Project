import type { Requirement } from "../domain/requirement.ts";
import { isSourceFile } from "./source-file.ts";

export const RELEVANT_FILE_LIMIT = 8;
// Larger files are almost always generated (bundles, fixtures) and would drown the keyword signal.
export const MAX_SOURCE_CHARS = 200_000;
// A word in the file name is the strongest hint, then a folder name, then the file's text.
const WEIGHT = { name: 3, folder: 2, content: 1 } as const;
// The area ("Cart") usually names a folder or module, so its words count double.
const AREA_MULTIPLIER = 2;
const STOP_WORDS = new Set(
  (
    "the and are for with that this from into when then than can will must should shall may all any each " +
    "only not but its their they them there these those has have had was were been being also same one " +
    "per until instead which what who how more most such via over under after before while both either " +
    "other some very just does did our your you his her him she etc"
  ).split(" "),
);

export type RepoFile = { readonly path: string; readonly text: string };
type IndexedFile = {
  readonly path: string;
  readonly name: ReadonlySet<string>;
  readonly folders: ReadonlySet<string>;
  readonly content: ReadonlySet<string>;
};
export type FileIndex = readonly IndexedFile[];
export type RelevantFile = {
  readonly path: string;
  readonly score: number;
  readonly matched: readonly string[];
};

/** Splits the repo's source files into words once, so many requirements can be ranked against them. */
export function indexFiles(files: readonly RepoFile[]): FileIndex {
  return files
    .filter((f) => isSourceFile(f.path) && f.text.length <= MAX_SOURCE_CHARS)
    .map((f) => {
      const folders = f.path.split("/");
      const base = folders.pop() ?? "";
      return {
        path: f.path,
        name: new Set(fileWords(base.replace(/\.[^.]+$/, ""))),
        folders: new Set(folders.flatMap(fileWords)),
        content: new Set(fileWords(f.text)),
      };
    });
}

/** The files most likely to implement a requirement, best first, by keyword overlap with path and text. */
export function rankRelevantFiles(
  requirement: Pick<Requirement, "area" | "text">,
  index: FileIndex,
  limit: number = RELEVANT_FILE_LIMIT,
): readonly RelevantFile[] {
  const area = new Set(keywords(requirement.area));
  const all = new Set([...area, ...keywords(requirement.text)]);
  return index
    .map((f) => {
      let score = 0;
      const matched: string[] = [];
      for (const word of all) {
        const weight = f.name.has(word)
          ? WEIGHT.name
          : f.folders.has(word)
            ? WEIGHT.folder
            : f.content.has(word)
              ? WEIGHT.content
              : 0;
        if (weight === 0) continue;
        score += area.has(word) ? weight * AREA_MULTIPLIER : weight;
        matched.push(word);
      }
      return { path: f.path, score, matched: matched.sort() };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || (a.path < b.path ? -1 : 1))
    .slice(0, limit);
}

// "isEmpty", "place-order", "place_order" -> ["is", "empty", "place", "order", ...]. Letters of any script count
// (PRDs are not always English); words under 3 letters and bare numbers carry no meaning here.
function tokens(text: string): string[] {
  return text
    .replace(/(\p{Ll}|\p{N})(\p{Lu})/gu, "$1 $2")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3 && !/^\p{N}+$/u.test(w));
}

function fileWords(text: string): string[] {
  return tokens(text).map(singular);
}

function keywords(text: string): string[] {
  return tokens(text)
    .filter((w) => !STOP_WORDS.has(w))
    .map(singular);
}

// Both sides go through the same folding, so an imperfect stem ("status" -> "statu") still matches itself.
function singular(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && /(ss|x|z|ch|sh)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}
