import type { ExtractedRequirements } from "../services/extract-requirements.ts";

const MAX_WIDTH = 100;
const plural = (n: number, word: string): string => `${String(n)} ${word}${n === 1 ? "" : "s"}`;

/** Terminal view of extracted requirements: a count, then one line per requirement grouped by area. */
export function formatRequirements(folder: string, extracted: ExtractedRequirements): string {
  const { prdFiles, requirements } = extracted;
  const header = `Found ${plural(requirements.length, "requirement")} in ${plural(prdFiles.length, "PRD file")} (${folder})`;
  if (requirements.length === 0) {
    return [
      header,
      "",
      'No tagged items (like "Area 1.2: ...") or headings with text under them were found.',
    ].join("\n");
  }

  const byArea = new Map<string, string[]>();
  for (const r of requirements) {
    const [first = "", ...rest] = r.text.split("\n");
    const shown = first.length > MAX_WIDTH ? `${first.slice(0, MAX_WIDTH - 1)}…` : first;
    const more = rest.length > 0 && shown === first ? " …" : "";
    const line = `  ${r.tag}  ${shown}${more}  (${r.source.file}:${String(r.source.line)})`;
    byArea.set(r.area, [...(byArea.get(r.area) ?? []), line]);
  }
  const found = new Set(requirements.map((r) => r.source.file));
  const empty = prdFiles.filter((f) => !found.has(f));
  const emptyNote = empty.length > 0 ? ["", `No requirements found in: ${empty.join(", ")}`] : [];
  return [
    header,
    ...[...byArea].flatMap(([area, lines]) => ["", area, ...lines]),
    ...emptyNote,
  ].join("\n");
}
