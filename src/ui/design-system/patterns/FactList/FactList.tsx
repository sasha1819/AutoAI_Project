import type { ReactNode } from "react";
import { isBlank, nameKey } from "../../accessibility/accessible-name.ts";

export type Fact = {
  /** Non-blank and unique in the list ("Element", "Waited"). */
  readonly label: string;
  readonly value: ReactNode;
  /** Ids, selectors, timings ("#element-id"). */
  readonly mono?: boolean;
};

export type FactListProps = { readonly facts: readonly Fact[] };

/**
 * Label/value pairs (mockup 7 and 14 "Quick facts": 12px, label muted on the left, value on the right, 22px apart),
 * as a description list so each value is read with its label. Usually inside a sunken Card under a caps heading.
 */
export function FactList({ facts }: FactListProps) {
  if (facts.length === 0) throw new Error("FactList needs at least one fact");
  const labels = new Set<string>();
  for (const f of facts) {
    if (isBlank(f.label)) throw new Error("FactList: every fact needs a non-blank label");
    if (labels.has(nameKey(f.label)))
      throw new Error(`FactList: the label "${f.label}" is used twice`);
    labels.add(nameKey(f.label));
  }
  return (
    <dl className="flex flex-col gap-1.5 text-sm">
      {facts.map((f) => (
        <div key={f.label} className="flex min-w-0 items-baseline justify-between gap-4">
          <dt className="shrink-0 text-text-secondary">{f.label}</dt>
          <dd
            className={`min-w-0 text-right break-words text-text-primary ${f.mono === true ? "font-mono" : ""}`}
          >
            {f.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
