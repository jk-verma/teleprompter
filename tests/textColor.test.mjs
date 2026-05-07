import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { JSDOM } from "jsdom"
import { applyTextColorToRange } from "../src/features/content/color.js"

const contentSource = readFileSync(
  new URL("../src/features/content/Content.tsx", import.meta.url),
  "utf8",
)

const createDocument = () =>
  new JSDOM(`<!doctype html><html><body></body></html>`).window.document

test("applies text color only to the selected range", () => {
  const document = createDocument()
  const editor = document.createElement("div")
  editor.contentEditable = "true"
  editor.innerHTML = "<p>Hello world again</p>"
  document.body.appendChild(editor)

  const textNode = editor.querySelector("p")?.firstChild
  assert.ok(textNode)

  const range = document.createRange()
  range.setStart(textNode, 6)
  range.setEnd(textNode, 11)

  const nextRange = applyTextColorToRange(editor, range, "#ff0000")
  assert.ok(nextRange)

  assert.match(
    editor.innerHTML,
    /^<p>Hello <span style="color: rgb\(255, 0, 0\);">world<\/span> again<\/p>$/,
  )
})

test("does not color the whole text when selection is collapsed", () => {
  const document = createDocument()
  const editor = document.createElement("div")
  editor.contentEditable = "true"
  editor.innerHTML = "<p>Hello world</p>"
  document.body.appendChild(editor)

  const textNode = editor.querySelector("p")?.firstChild
  assert.ok(textNode)

  const range = document.createRange()
  range.setStart(textNode, 3)
  range.setEnd(textNode, 3)

  const nextRange = applyTextColorToRange(editor, range, "#ff0000")
  assert.equal(nextRange, null)
  assert.equal(editor.innerHTML, "<p>Hello world</p>")
})

test("text color control cannot change the whole editor default color", () => {
  assert.doesNotMatch(contentSource, /color:\s*settings\.fontColor/)
  assert.match(contentSource, /applyTextColor\(color\)/)
})
