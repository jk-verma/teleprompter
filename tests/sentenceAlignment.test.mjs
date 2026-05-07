import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { JSDOM } from "jsdom";
import { applySentenceAlignment } from "../src/features/content/alignment.js";

let dom;
let originalWindow;
let originalDocument;
let originalNode;
let originalNodeFilter;

before(() => {
  dom = new JSDOM(`<!doctype html><html><body></body></html>`);
  originalWindow = globalThis.window;
  originalDocument = globalThis.document;
  originalNode = globalThis.Node;
  originalNodeFilter = globalThis.NodeFilter;

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Node = dom.window.Node;
  globalThis.NodeFilter = dom.window.NodeFilter;
});

after(() => {
  globalThis.window = originalWindow;
  globalThis.document = originalDocument;
  globalThis.Node = originalNode;
  globalThis.NodeFilter = originalNodeFilter;
});

test("applies alignment to the current sentence only", () => {
  const editor = document.createElement("div");
  editor.contentEditable = "true";
  editor.innerHTML = "<p>Hello world. Another sentence stays untouched.</p>";
  document.body.appendChild(editor);

  const textNode = editor.querySelector("p")?.firstChild;
  assert.ok(textNode);

  const range = document.createRange();
  range.setStart(textNode, 4);
  range.setEnd(textNode, 4);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);

  const applied = applySentenceAlignment(editor, "justifyCenter");
  assert.equal(applied, true);

  const aligned = editor.querySelector("[data-sentence-align='true']");
  assert.ok(aligned);
  assert.equal(aligned?.style.textAlign, "center");
  assert.match(
    editor.innerHTML,
    /<span[^>]+data-sentence-align="true"[^>]*>Hello world\.<\/span>/,
  );
  assert.match(editor.innerHTML, /Another sentence stays untouched\./);
});

test("applies alignment from a saved range when toolbar focus clears selection", () => {
  const editor = document.createElement("div");
  editor.contentEditable = "true";
  editor.innerHTML = "<p>Hello world. Another sentence stays untouched.</p>";
  document.body.appendChild(editor);

  const textNode = editor.querySelector("p")?.firstChild;
  assert.ok(textNode);

  const savedRange = document.createRange();
  savedRange.setStart(textNode, 18);
  savedRange.setEnd(textNode, 18);

  const selection = window.getSelection();
  selection?.removeAllRanges();

  const applied = applySentenceAlignment(editor, "justifyRight", savedRange);
  assert.equal(applied, true);

  const aligned = editor.querySelector("[data-sentence-align='true']");
  assert.ok(aligned);
  assert.equal(aligned?.style.textAlign, "right");
  assert.match(editor.innerHTML, /Hello world\./);
  assert.match(
    editor.innerHTML,
    /<span[^>]+data-sentence-align="true"[^>]*>Another sentence stays untouched\.<\/span>/,
  );
});
