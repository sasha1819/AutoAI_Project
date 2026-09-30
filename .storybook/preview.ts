import type { Preview } from "@storybook/react-vite";
import { withThemeByDataAttribute } from "@storybook/addon-themes";
import "../src/ui/design-system/tokens/theme.css";

const preview: Preview = {
  parameters: {
    // Every story is checked with axe; a violation shows as an error in the Accessibility panel.
    a11y: { test: "error" },
    backgrounds: { disable: true },
    layout: "padded",
  },
  // Dark is the only theme for now; the switch is here so a light theme is a tokens-only change later.
  decorators: [
    withThemeByDataAttribute({
      themes: { dark: "dark" },
      defaultTheme: "dark",
      attributeName: "data-theme",
    }),
  ],
};

export default preview;
