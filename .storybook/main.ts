import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";

// The design system is built and reviewed here before any screen exists (ADR 0006).
const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../src/ui/**/*.stories.tsx"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-themes"],
  core: { disableTelemetry: true },
  viteFinal: (vite) => ({
    ...vite,
    plugins: [...(vite.plugins ?? []), tailwindcss()],
    optimizeDeps: {
      ...vite.optimizeDeps,
      // React 19 ships as CommonJS. In the dev server Vite must pre-bundle it into ESM, or the browser fails with
      // "react/index.js does not provide an export named 'default'" and no story renders (the static build is
      // unaffected because it bundles everything). Listing them makes the pre-bundle explicit.
      include: [
        ...(vite.optimizeDeps?.include ?? []),
        "react",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-dom",
        "react-dom/client",
        "lucide-react",
      ],
    },
  }),
};

export default config;
