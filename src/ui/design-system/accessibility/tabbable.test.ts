import { describe, expect, it } from "vitest";
import { tabbables } from "./tabbable.ts";

const ids = (html: string): string[] => {
  const root = document.createElement("div");
  root.innerHTML = html;
  return tabbables(root).map((el) => el.id);
};

describe("tabbables", () => {
  it("finds what Tab reaches, in page order", () => {
    expect(
      ids(`<a id="a" href="#">a</a><button id="b">b</button><input id="c"><select id="d"></select>
           <textarea id="e"></textarea><details><summary id="f">f</summary></details>
           <div id="g" contenteditable="true"></div><div id="h" tabindex="0"></div>`),
    ).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);
  });

  it.each([
    ["a link with no href", `<a id="x">x</a>`],
    ["tabindex -1", `<button id="x" tabindex="-1">x</button>`],
    ["a hidden input", `<input id="x" type="hidden">`],
    ["a disabled control", `<button id="x" disabled>x</button>`],
    ["a disabled control with a tabindex", `<button id="x" disabled tabindex="0">x</button>`],
    ["a control in a hidden area", `<div hidden><button id="x">x</button></div>`],
    ["a control in an inert area", `<div inert><button id="x">x</button></div>`],
    ["a control in a disabled fieldset", `<fieldset disabled><input id="x"></fieldset>`],
    ["contenteditable=false", `<div id="x" contenteditable="false"></div>`],
  ])("skips %s", (_name, html) => {
    expect(ids(html)).toEqual([]);
  });
});
