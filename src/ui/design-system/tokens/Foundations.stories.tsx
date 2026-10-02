import type { Meta, StoryObj } from "@storybook/react-vite";

// A read-only view of the tokens in theme.css, for review. Class names are written out in full because Tailwind
// only generates utilities it can find literally in the source.
const meta: Meta = { title: "Foundations/Tokens" };
export default meta;

type Swatch = { readonly name: string; readonly className: string; readonly use: string };

const GROUPS: readonly { readonly title: string; readonly swatches: readonly Swatch[] }[] = [
  {
    title: "Surfaces",
    swatches: [
      { name: "app", className: "bg-app", use: "title bar, icon rail, status bar" },
      { name: "canvas", className: "bg-canvas", use: "page background" },
      { name: "surface", className: "bg-surface", use: "cards, side panels" },
      { name: "inset", className: "bg-inset", use: "boxes inside a card" },
      { name: "raised", className: "bg-raised", use: "chips, inputs, neutral tags" },
      { name: "hover", className: "bg-hover", use: "row and control hover" },
      { name: "selected", className: "bg-selected", use: "selected row" },
    ],
  },
  {
    title: "Text",
    swatches: [
      { name: "text-primary", className: "bg-text-primary", use: "titles, body" },
      { name: "text-secondary", className: "bg-text-secondary", use: "subtitles, labels" },
      { name: "text-muted", className: "bg-text-muted", use: "meta text (lightened for 4.5:1)" },
      { name: "text-link", className: "bg-text-link", use: "file paths, links" },
      {
        name: "text-on-accent",
        className: "bg-text-on-accent",
        use: "label on the primary button",
      },
    ],
  },
  {
    title: "Primary action and AI (violet: primary buttons and AI actions only)",
    swatches: [
      { name: "accent", className: "bg-accent", use: "primary button" },
      { name: "accent-hover", className: "bg-accent-hover", use: "primary button, hover" },
      { name: "accent-pressed", className: "bg-accent-pressed", use: "primary button, pressed" },
      { name: "accent-strong", className: "bg-accent-strong", use: "active tab indicator" },
      { name: "focus-ring", className: "bg-focus-ring", use: "keyboard focus ring" },
      { name: "ai-surface", className: "bg-ai-surface", use: "AI chip / panel background" },
      { name: "ai-border", className: "bg-ai-border", use: "AI chip / panel edge" },
      { name: "ai-text", className: "bg-ai-text", use: "AI chip text" },
    ],
  },
  {
    title: "Status (mapped from domain values by StatusPill / SeverityTag only)",
    swatches: [
      { name: "status-passed", className: "bg-status-passed", use: "passed" },
      { name: "status-passed-surface", className: "bg-status-passed-surface", use: "passed badge" },
      { name: "status-failed", className: "bg-status-failed", use: "failed" },
      {
        name: "status-failed-text",
        className: "bg-status-failed-text",
        use: "failed / high tag text",
      },
      {
        name: "status-failed-surface",
        className: "bg-status-failed-surface",
        use: "failed / high tag",
      },
      { name: "status-warning", className: "bg-status-warning", use: "flaky, warning" },
      {
        name: "status-warning-surface",
        className: "bg-status-warning-surface",
        use: "flaky / medium tag",
      },
      { name: "status-running", className: "bg-status-running", use: "running" },
      {
        name: "status-running-surface",
        className: "bg-status-running-surface",
        use: "running badge",
      },
      {
        name: "status-neutral",
        className: "bg-status-neutral",
        use: "not-run dot (graphics only)",
      },
      {
        name: "status-neutral-surface",
        className: "bg-status-neutral-surface",
        use: "not run / low tag",
      },
    ],
  },
  {
    title: "Borders",
    swatches: [
      { name: "border-subtle", className: "bg-border-subtle", use: "card edge" },
      { name: "border-default", className: "bg-border-default", use: "panel dividers" },
      { name: "border-strong", className: "bg-border-strong", use: "secondary button edge" },
      { name: "border-field", className: "bg-border-field", use: "form field edge (3:1 at rest)" },
      {
        name: "border-field-hover",
        className: "bg-border-field-hover",
        use: "form field edge, hover",
      },
    ],
  },
];

export const Colors: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-8">
      {GROUPS.map((group) => (
        <section key={group.title} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-text-primary">{group.title}</h2>
          <ul className="grid grid-cols-4 gap-3">
            {group.swatches.map((s) => (
              <li
                key={s.name}
                className="flex flex-col gap-2 rounded-card border border-border-subtle bg-surface p-3"
              >
                <span
                  className={`h-10 rounded-control border border-border-default ${s.className}`}
                />
                <span className="font-mono text-sm text-text-primary">{s.name}</span>
                <span className="text-xs text-text-muted">{s.use}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  ),
};

const TYPE: readonly { readonly className: string; readonly label: string }[] = [
  { className: "text-display font-bold", label: "display 40 · product name" },
  { className: "text-2xl font-bold", label: "2xl 28 · stat numbers" },
  { className: "text-xl font-bold", label: "xl 22 · page title" },
  { className: "text-lg font-semibold", label: "lg 15 · section title" },
  { className: "text-md", label: "md 13 · body" },
  { className: "text-sm font-medium", label: "sm 12 · buttons, meta" },
  {
    className: "text-xs font-semibold uppercase tracking-wide",
    label: "xs 11 · caps labels, tags",
  },
  { className: "font-mono text-sm", label: "mono 12 · ids, tags, timings" },
];

export const Typography: StoryObj = {
  render: () => (
    <ul className="flex flex-col gap-4 text-text-primary">
      {TYPE.map((t) => (
        <li key={t.label} className="flex items-baseline gap-6">
          <span className={t.className}>The quick brown fox</span>
          <span className="text-xs text-text-muted">{t.label}</span>
        </li>
      ))}
    </ul>
  ),
};

export const Radii: StoryObj = {
  render: () => (
    <div className="flex gap-6">
      {[
        { className: "rounded-tag", label: "tag 5" },
        { className: "rounded-control", label: "control 6" },
        { className: "rounded-card", label: "card 8" },
        { className: "rounded-full", label: "full" },
      ].map((r) => (
        <div key={r.label} className="flex flex-col items-center gap-2">
          <span className={`h-12 w-20 border border-border-strong bg-raised ${r.className}`} />
          <span className="text-xs text-text-muted">{r.label}</span>
        </div>
      ))}
    </div>
  ),
};

// The 4px grid: every spacing, size and gap is a multiple of the --spacing token.
export const Spacing: StoryObj = {
  render: () => (
    <ul className="flex flex-col gap-2">
      {[
        { className: "w-1", label: "1 · 4px" },
        { className: "w-2", label: "2 · 8px" },
        { className: "w-3", label: "3 · 12px (gap between cards)" },
        { className: "w-4", label: "4 · 16px" },
        { className: "w-5", label: "5 · 20px (card padding)" },
        { className: "w-6", label: "6 · 24px" },
        { className: "w-7.5", label: "7.5 · 30px (control height md)" },
        { className: "w-10", label: "10 · 40px (control height lg)" },
        { className: "w-11", label: "11 · 44px (control height xl)" },
        { className: "w-16", label: "16 · 64px" },
      ].map((s) => (
        <li key={s.label} className="flex items-center gap-4">
          <span className={`h-3 rounded-tag bg-accent-strong ${s.className}`} />
          <span className="font-mono text-sm text-text-secondary">{s.label}</span>
        </li>
      ))}
    </ul>
  ),
};

export const Elevation: StoryObj = {
  render: () => (
    <div className="flex gap-8">
      <div className="relative h-40 w-72 overflow-hidden rounded-card bg-surface p-5">
        <span className="text-sm text-text-secondary">Content behind a modal</span>
        <div className="absolute inset-0 flex items-center justify-center bg-scrim">
          <div className="rounded-card bg-surface p-4 text-sm text-text-primary shadow-overlay">
            scrim + shadow-overlay
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <span className="rounded-control bg-raised px-3 py-2 text-sm text-text-primary">
          Enabled control
        </span>
        <span className="rounded-control bg-raised px-3 py-2 text-sm text-text-primary opacity-disabled">
          Disabled control (opacity-disabled)
        </span>
      </div>
    </div>
  ),
};
