import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest runs without globals, so Testing Library cannot clean up by itself: unmount after every UI test.
afterEach(() => {
  cleanup();
});
