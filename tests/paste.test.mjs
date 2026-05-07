import assert from "node:assert/strict"
import { test } from "node:test"
import { JSDOM } from "jsdom"
import { createPlainTextFragment } from "../src/features/content/paste.js"

const createDocument = () =>
  new JSDOM(`<!doctype html><html><body></body></html>`).window.document

test("pasted plain text does not keep excessive blank lines", () => {
  const document = createDocument()
  const host = document.createElement("div")
  const fragment = createPlainTextFragment(document, "One\n\n\n\nTwo")

  host.append(fragment)

  assert.equal(host.innerHTML, "One<br><br>Two")
})

test("pasted plain text uses line breaks instead of paragraph margins", () => {
  const document = createDocument()
  const host = document.createElement("div")
  const fragment = createPlainTextFragment(document, "One\nTwo")

  host.append(fragment)

  assert.equal(host.querySelector("p"), null)
  assert.equal(host.innerHTML, "One<br>Two")
})
