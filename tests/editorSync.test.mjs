import assert from "node:assert/strict"
import { test } from "node:test"
import { shouldSyncEditorContent } from "../src/features/content/editorSync.js"

test("syncs editor content when the editor is not focused", () => {
  const editor = {}
  const activeElement = {}

  assert.equal(shouldSyncEditorContent(activeElement, editor), true)
})

test("preserves editor content while the editor is focused", () => {
  const editor = {}

  assert.equal(shouldSyncEditorContent(editor, editor), false)
})

test("forces sync while the editor is focused when requested", () => {
  const editor = {}

  assert.equal(shouldSyncEditorContent(editor, editor, true), true)
})
