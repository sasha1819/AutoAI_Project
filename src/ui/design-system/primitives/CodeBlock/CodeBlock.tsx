import { Check, CircleAlert, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import {
  assertAccessibleName,
  isBlank,
  type NonEmpty,
} from "../../accessibility/accessible-name.ts";
import { IconButton } from "../IconButton/index.ts";

export type CodeBlockProps<Label extends string = string> = {
  /**
   * Names the code for screen readers ("Generated test: cart-add.spec.ts"). Each CodeBlock is a region landmark, so
   * two on one screen need different labels.
   */
  readonly label: NonEmpty<Label>;
  /** The code, shown as is (no wrapping, no highlighting). Never blank. */
  readonly code: string;
  /** Line numbers in their own column: not read out and not copied. */
  readonly lineNumbers?: boolean;
  /** A Copy button that copies the code exactly. */
  readonly copyable?: boolean;
  /** fit: as tall as the code · scroll: at most 384px, then it scrolls. */
  readonly height?: "fit" | "scroll";
};

type CopyState = "idle" | "copied" | "failed";

/** How long "Copied" shows before the button goes back to Copy. A UI timing, so it lives here. */
const COPIED_MS = 2000;
const SAID: Record<CopyState, string> = { idle: "", copied: "Copied", failed: "Copy failed" };
// The button shows the result too (its tooltip says it in words), so sighted users see what was announced.
const BUTTON: Record<CopyState, { readonly label: string; readonly icon: typeof Copy }> = {
  idle: { label: "Copy code", icon: Copy },
  copied: { label: "Copied", icon: Check },
  failed: { label: "Copy failed", icon: CircleAlert },
};

/**
 * Read-only code (a generated test, a suggested fix). One scroll area, focusable and named, so long lines and long
 * files can be scrolled by keyboard; the line numbers stay put while it scrolls sideways. The copy result is said in
 * a status that is always on the page. A closed set of props; nothing spread.
 */
export function CodeBlock<Label extends string>({
  label,
  code,
  lineNumbers = true,
  copyable = true,
  height = "fit",
}: CodeBlockProps<Label>) {
  assertAccessibleName(label, "CodeBlock");
  if (isBlank(code)) throw new Error("CodeBlock needs code to show");
  const [copy, setCopy] = useState<CopyState>("idle");
  useEffect(() => {
    if (copy === "idle") return;
    const t = setTimeout(() => {
      setCopy("idle");
    }, COPIED_MS);
    return () => {
      clearTimeout(t);
    };
  }, [copy]);
  const shown = code.endsWith("\n") ? code.slice(0, -1) : code;
  const count = shown.split("\n").length;

  return (
    // The copy button has its own column, so it never covers a long line.
    <div className="flex min-w-0 items-start rounded-card border border-border-default bg-sunken">
      <div
        role="region"
        aria-label={label}
        tabIndex={0}
        className={`min-w-0 flex-1 overflow-auto rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${height === "scroll" ? "max-h-96" : ""}`}
      >
        <div className="flex min-w-max py-3 font-mono text-sm ligatures-none">
          {lineNumbers && (
            <div
              aria-hidden="true"
              className="sticky left-0 bg-sunken pr-4 pl-3.5 text-right text-text-muted select-none"
            >
              {Array.from({ length: count }, (_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
          )}
          <pre className={`pr-3.5 text-text-primary ${lineNumbers ? "" : "pl-3.5"}`}>
            <code>{shown}</code>
          </pre>
        </div>
      </div>
      {copyable && (
        <div className="shrink-0 p-2">
          <IconButton
            label={BUTTON[copy].label}
            icon={BUTTON[copy].icon}
            size="sm"
            onClick={() => {
              // Back to idle first, so copying again restarts the timer and is announced again.
              setCopy("idle");
              // A missing clipboard (no secure context) throws before the promise: count it as a failure too.
              Promise.resolve()
                .then(() => navigator.clipboard.writeText(code))
                .then(
                  () => {
                    setCopy("copied");
                  },
                  () => {
                    setCopy("failed");
                  },
                );
            }}
          />
        </div>
      )}
      <span role="status" className="sr-only">
        {SAID[copy]}
      </span>
    </div>
  );
}
