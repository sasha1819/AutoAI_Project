import type { ReactNode } from "react";

export type PageColumnProps = { readonly children: ReactNode };

/**
 * A top-aligned page (mockup 3, and the later scan results, Settings and Reports): one column, max-w-215 wide,
 * centred across the window, starting near the top. The onboarding steps before it use CenteredPage instead.
 */
export function PageColumn({ children }: PageColumnProps) {
  return (
    <div className="px-6 pt-11 pb-12">
      <div className="mx-auto flex w-full max-w-215 flex-col">{children}</div>
    </div>
  );
}
