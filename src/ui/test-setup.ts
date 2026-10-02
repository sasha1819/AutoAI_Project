import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest runs without globals, so Testing Library cannot clean up by itself: unmount after every UI test.
afterEach(() => {
  cleanup();
});

// jsdom has no pointer capture or scrolling. Radix (Select, later Popover and Tooltip) calls them while opening and
// moving through a list; these stand-ins do nothing, which is all a test needs.
if (!("hasPointerCapture" in Element.prototype)) {
  Object.assign(Element.prototype, {
    hasPointerCapture: () => false,
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
  });
}
if (!("scrollIntoView" in Element.prototype)) {
  Object.assign(Element.prototype, { scrollIntoView: () => undefined });
}
