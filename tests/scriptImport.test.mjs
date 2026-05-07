import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { before, after, test } from "node:test"
import { JSDOM } from "jsdom"
import { normalizeImportedScript } from "../src/lib/scriptImport.js"

let originalDomParser
const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8")

before(() => {
  originalDomParser = globalThis.DOMParser
  const { window } = new JSDOM("")
  globalThis.DOMParser = window.DOMParser
})

after(() => {
  globalThis.DOMParser = originalDomParser
})

test("converts plain text into paragraph html", () => {
  const html = normalizeImportedScript("Hello <world>\n\nSecond line", "notes.txt", "text/plain")

  assert.equal(html, "<p>Hello &lt;world&gt;</p><p><br></p><p>Second line</p>")
})

test("preserves html fragments and extracts html documents", () => {
  const fragment = normalizeImportedScript("<p>Fragment</p><strong>Kept</strong>", "fragment.html", "text/html")
  const documentHtml = normalizeImportedScript(
    "<!doctype html><html><body><p>Document</p></body></html>",
    "document.html",
    "text/html",
  )

  assert.equal(fragment, "<p>Fragment</p><strong>Kept</strong>")
  assert.equal(documentHtml, "<p>Document</p>")
})

test("keeps plain text inside html files readable", () => {
  const html = normalizeImportedScript(
    "<!doctype html><html><body>Hello <world>\nSecond line</body></html>",
    "plain-text.html",
    "text/html",
  )

  assert.equal(html, "<p>Hello &lt;world&gt;</p><p>Second line</p>")
})

test("supports xhtml files like html", () => {
  const html = normalizeImportedScript(
    "<?xml version=\"1.0\"?><html xmlns=\"http://www.w3.org/1999/xhtml\"><body><p>XHTML</p></body></html>",
    "page.xhtml",
    "application/xhtml+xml",
  )

  assert.equal(html, "<p>XHTML</p>")
})

test("extracts common content fields from json files", () => {
  const html = normalizeImportedScript(
    JSON.stringify({
      title: "Sample",
      content: "Line 1\nLine 2",
      blocks: ["<p>Ignored</p>"],
    }),
    "sample.json",
    "application/json",
  )

  assert.equal(html, "<p>Line 1</p><p>Line 2</p>")
})

test("returns html content from json html fields", () => {
  const html = normalizeImportedScript(
    JSON.stringify({
      scriptHtml: "<p>Ready</p>",
    }),
    "sample.json",
    "application/json",
  )

  assert.equal(html, "<p>Ready</p>")
})

test("parses nested json string content safely", () => {
  const html = normalizeImportedScript(
    JSON.stringify({
      blocks: [
        { text: "One" },
        { content: "Two" },
        "<p>Three</p>",
      ],
    }),
    "blocks.json",
    "application/json",
  )

  assert.equal(html, "<p>One</p><p>Two</p><p>Three</p>")
})

test("handles html documents with plain text bodies", () => {
  const html = normalizeImportedScript(
    "<!doctype html><html><body>Alpha <beta> Gamma</body></html>",
    "plain.html",
    "text/html",
  )

  assert.equal(html, "<p>Alpha &lt;beta&gt; Gamma</p>")
})

test("file import does not trigger reset that can overwrite imported text", () => {
  const handlerStart = appSource.indexOf("const handleFileSelected")
  const handlerEnd = appSource.indexOf("const saveFile", handlerStart)
  const handlerSource = appSource.slice(handlerStart, handlerEnd)

  assert.match(handlerSource, /setScriptHtml\(normalizeImportedScript/)
  assert.match(handlerSource, /setSyncSignal/)
  assert.doesNotMatch(handlerSource, /setResetSignal/)
})
