import type { ReactNode } from "react";

export type CenteredPageProps = {
  readonly children: ReactNode;
  /** A quiet line at the bottom of the window (mockup 1: "Built for QA & automation engineers"). */
  readonly footer?: ReactNode;
};

/**
 * The onboarding layout (mockups 1 and 2): one centred column on the canvas, filling the screen's area, with an
 * optional footer at the bottom. Screens put their heading, text, card and actions inside; the column centres them.
 */
export function CenteredPage({ children, footer }: CenteredPageProps) {
  return (
    <div className="flex h-full min-h-full flex-col px-6">
      <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
        {children}
      </div>
      {footer !== undefined && footer !== null && (
        <div className="pb-6 text-center text-xs text-text-muted">{footer}</div>
      )}
    </div>
  );
}
