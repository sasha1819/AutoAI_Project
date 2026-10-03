import { ArrowRight } from "../../design-system/primitives/Icon/index.ts";
import { CenteredPage } from "../../design-system/patterns/CenteredPage/index.ts";
import { Button } from "../../design-system/primitives/Button/index.ts";

export type WelcomeViewProps = {
  /** Starts onboarding: Connect AI comes next (PRD Flow 1). */
  readonly onGetStarted: () => void;
};

/**
 * The first screen (mockup 1, PRD Flow 1 step 1): what AutoAI does, and one way forward. It needs nothing from main,
 * so it has no hook. Left out on purpose (recorded): the platform chips (the MVP is web only), the violet "AI" in
 * the name (violet is closed to primary and AI actions), "I already have a project connected" (nothing is saved
 * yet; it comes with persistence), and the drawn close button (the native frame has one).
 */
export function WelcomeView({ onGetStarted }: WelcomeViewProps) {
  return (
    <CenteredPage footer="Built for QA & automation engineers · powered by Claude">
      <h1 className="text-display font-bold text-text-primary">AutoAI</h1>
      <p className="mt-3 text-lg font-medium text-text-primary">
        Test your web application without writing a line of code.
      </p>
      <p className="mt-7 max-w-140 text-md text-text-secondary">
        Point AutoAI at your repository and your product requirements. It finds where the spec and
        the code disagree, writes Playwright tests to check each one, runs them, and explains
        failures in plain words — with your own Claude API key.
      </p>
      <div className="mt-9">
        <Button size="xl" trailingIcon={ArrowRight} onClick={onGetStarted}>
          Get started
        </Button>
      </div>
    </CenteredPage>
  );
}
