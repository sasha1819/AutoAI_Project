import { Code, FileText } from "lucide-react";
import { type ReactElement, useId } from "react";
import type { Finding, FindingType, ReviewReason } from "../../../../core/domain/finding.ts";
import { Badge } from "../../primitives/Badge/index.ts";
import { Card } from "../../primitives/Card/index.ts";
import { Icon, type IconGlyph } from "../../primitives/Icon/index.ts";
import { ConfidenceMeter } from "../ConfidenceMeter/index.ts";
import { RequirementTag } from "../RequirementTag/index.ts";
import { SeverityTag } from "../SeverityTag/index.ts";

export type FindingCardProps = {
  readonly finding: Finding;
  /** What the user can do (an AiActionButton, "Mark as intended", "Open in code"): the screen decides. */
  readonly actions?: ReactElement;
  /** The level of the card's heading in the page outline (default 3). */
  readonly headingLevel?: 2 | 3 | 4;
};

// The right column's label: a finding that needs review is never stated as fact (CLAUDE.md rule 5).
const CODE_LABEL: Record<FindingType, { readonly sure: string; readonly unsure: string }> = {
  mismatch: { sure: "What the code actually does", unsure: "What the code may do" },
  not_implemented: { sure: "In the code", unsure: "In the code (not confirmed)" },
  match: { sure: "What the code does", unsure: "What the code may do" },
};
// A mismatch is the default view; the other kinds say what they are.
const KIND: Record<FindingType, string | undefined> = {
  mismatch: undefined,
  not_implemented: "Not implemented",
  match: "Matches",
};
const REASON: Record<ReviewReason, string> = {
  LOW_CONFIDENCE: "Claude is not sure about this one.",
  MISSING_EVIDENCE: "No code was quoted as evidence.",
  UNVERIFIED_EVIDENCE: "The quoted code was not found in the file.",
};
const HEADING = { 2: "h2", 3: "h3", 4: "h4" } as const;

function Column({
  icon,
  label,
  children,
}: {
  readonly icon: IconGlyph;
  readonly label: string;
  readonly children: ReactElement;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-text-secondary uppercase">
        <Icon glyph={icon} decorative size="xs" />
        {label}
      </p>
      {children}
    </div>
  );
}

/**
 * One spec-vs-code finding (mockup 11): the area and requirement as its heading, its severity, what the PRD says
 * next to what the code does, the evidence file, how sure Claude was, and the screen's actions.
 *
 * Severity: shown only when there is one. No severity is a real state, not only bad data: every match has none by
 * rule (core/rules/severity.ts), and a mismatch or not_implemented finding has none when the AI's answer left it
 * null or invalid (the answer schema allows null; the parser keeps it). Then nothing is shown (decision, 2026-10-02).
 *
 * A finding that needs review gets a "Needs review" tag, hedged wording and the reasons in words: it is never
 * shown as fact. Everything shown comes from the finding; no rule is applied here.
 */
export function FindingCard({ finding, actions, headingLevel = 3 }: FindingCardProps) {
  const headingId = useId();
  const level: number = headingLevel;
  if (level !== 2 && level !== 3 && level !== 4) {
    throw new Error(`FindingCard headingLevel must be 2, 3 or 4, got ${String(level)}`);
  }
  const Heading = HEADING[headingLevel];
  const {
    requirement,
    type,
    severity,
    explanation,
    evidence,
    confidence,
    reviewStatus,
    reviewReasons,
  } = finding;
  const unsure = reviewStatus === "needs_review";
  const kind = KIND[type];
  return (
    <Card as="article" labelledBy={headingId}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Heading id={headingId} className="flex min-w-0 flex-1 items-center gap-3">
            <Badge label={requirement.area} uppercase /> <RequirementTag tag={requirement.tag} />
          </Heading>
          {kind !== undefined && <Badge label={kind} />}
          {unsure && <Badge label="Needs review" />}
          {severity !== null && <SeverityTag severity={severity} />}
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:gap-0">
          <Column icon={FileText} label="What the PRD says">
            <p className="text-md text-text-primary md:pr-5">{requirement.text}</p>
          </Column>
          <div className="hidden w-px shrink-0 bg-border-default md:block" />
          <Column icon={Code} label={unsure ? CODE_LABEL[type].unsure : CODE_LABEL[type].sure}>
            <div className="flex flex-col gap-1 md:pl-5">
              <p className="text-md text-text-primary">{explanation}</p>
              {evidence !== null && (
                <p className="font-mono text-sm break-all text-code-ref">
                  {evidence.file}
                  <span className="sr-only">
                    , lines {evidence.lines[0]} to {evidence.lines[1]}
                  </span>
                </p>
              )}
              {unsure && reviewReasons.length > 0 && (
                <ul className="flex flex-col gap-0.5 text-sm text-text-secondary">
                  {reviewReasons.map((r) => (
                    <li key={r}>{REASON[r]}</li>
                  ))}
                </ul>
              )}
            </div>
          </Column>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {actions !== undefined && <div className="flex flex-wrap gap-2">{actions}</div>}
          <div className="ml-auto flex items-center gap-4">
            <ConfidenceMeter confidence={confidence} />
            {evidence !== null && (
              <p className="text-xs text-text-muted">Found while scanning {evidence.file}</p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
