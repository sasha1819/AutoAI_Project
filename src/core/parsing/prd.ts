import type { Requirement } from "../domain/requirement.ts";

export type PrdDocument = { readonly file: string; readonly text: string };

type Line = { readonly no: number; readonly text: string; readonly heading: Heading | null };
type Heading = { readonly level: number; readonly title: string };
type Draft = {
  tag: string;
  area: string;
  line: number;
  paragraphs: string[][];
  endsAtBlank: boolean;
};

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE = /^\s*(```|~~~)/;
const LIST_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/;
const TABLE_ROW = /^\s*\|/;
// "Cart 2.4: text" / "Checkout Flow 3.1 - text" / "Checkout 3: text". A separator (or end of line) must follow
// the number, so title-case prose like "See Cart 2.4 for details" is not a tag.
const TAG =
  /^([A-Z][A-Za-z]*(?:[ -][A-Z][A-Za-z]*)*) (\d+(?:\.\d+)+|\d+(?=:))(?:\s*[:.)—–-]|(?=\s*$))\s*(.*)$/;

/** Splits one PRD into requirements: tagged items ("Cart 2.4: ...") if the file has any, else heading sections. */
export function parsePrd(doc: PrdDocument): readonly Requirement[] {
  const lines = scan(doc.text);
  const drafts = lines.some((l) => tagOf(l) !== null) ? taggedItems(lines) : headingSections(lines);
  return drafts.flatMap((d) => {
    const text = d.paragraphs
      .map(collapse)
      .filter((p) => p !== "")
      .join("\n");
    return text === ""
      ? []
      : [{ tag: d.tag, area: d.area, text, source: { file: doc.file, line: d.line } }];
  });
}

function scan(text: string): Line[] {
  let fenced = false;
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((raw, i) => {
      const toggles = FENCE.test(raw);
      const hidden = fenced || toggles;
      if (toggles) fenced = !fenced;
      const h = hidden ? null : HEADING.exec(raw);
      const heading =
        h?.[1] && h[2] !== undefined ? { level: h[1].length, title: clean(h[2]) } : null;
      return { no: i + 1, text: hidden ? "" : raw, heading };
    });
}

function tagOf(line: Line): { tag: string; area: string; rest: string } | null {
  const lead = line.heading ? line.heading.title : clean(line.text.replace(LIST_MARKER, ""));
  const m = TAG.exec(lead);
  if (!m?.[1] || !m[2]) return null;
  return { tag: `${m[1]} ${m[2]}`, area: m[1], rest: m[3] ?? "" };
}

function taggedItems(lines: Line[]): Draft[] {
  const drafts: Draft[] = [];
  let current: Draft | null = null;
  for (const line of lines) {
    const t = tagOf(line);
    if (t) {
      const byHeading = line.heading !== null;
      current = {
        tag: t.tag,
        area: t.area,
        line: line.no,
        paragraphs: byHeading ? [[t.rest], []] : [[t.rest]],
        endsAtBlank: !byHeading,
      };
      drafts.push(current);
    } else if (current && line.heading) {
      current = null;
    } else if (current) {
      current = appendBodyLine(current, line.text);
    }
  }
  return drafts;
}

function headingSections(lines: Line[]): Draft[] {
  const titleIsLevelOne = lines.some((l) => l.heading && l.heading.level > 1);
  const drafts: Draft[] = [];
  let h1: string | null = null;
  let h2: string | null = null;
  let current: Draft | null = null;
  for (const line of lines) {
    if (!line.heading) {
      if (current) current = appendBodyLine(current, line.text);
      continue;
    }
    const { level, title } = line.heading;
    if (level === 1) [h1, h2] = [title, null];
    if (level === 2) h2 = title;
    const area = level <= 2 ? title : (h2 ?? h1 ?? title);
    current =
      title === "" || (level === 1 && titleIsLevelOne)
        ? null
        : { tag: title, area, line: line.no, paragraphs: [[]], endsAtBlank: false };
    if (current) drafts.push(current);
  }
  return drafts;
}

// Mutates the draft; returns null when a blank line closes an item that ends at the first blank line.
// Bullets and table rows start their own line so the text keeps the PRD's structure.
function appendBodyLine(draft: Draft, text: string): Draft | null {
  if (LIST_MARKER.test(text) || TABLE_ROW.test(text)) draft.paragraphs.push([text]);
  else if (text.trim() !== "") draft.paragraphs.at(-1)?.push(text);
  else if (draft.endsAtBlank) return null;
  else draft.paragraphs.push([]);
  return draft;
}

function clean(text: string): string {
  return collapse([text.replaceAll("**", "").replaceAll("__", "")]);
}

function collapse(parts: readonly string[]): string {
  return parts.join(" ").replace(/\s+/g, " ").trim();
}
