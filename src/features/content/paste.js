export const createPlainTextFragment = (document, text) => {
  const fragment = document.createDocumentFragment()
  const normalizedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const lines = normalizedText.replace(/\n{3,}/g, "\n\n").split("\n")

  lines.forEach((line, index) => {
    if (index > 0) {
      fragment.append(document.createElement("br"))
    }
    if (line) {
      fragment.append(document.createTextNode(line))
    }
  })

  return fragment
}

export const insertPlainTextAtSelection = (editor, text) => {
  const selection = editor.ownerDocument.getSelection()
  if (!selection || selection.rangeCount === 0) {
    editor.append(createPlainTextFragment(editor.ownerDocument, text))
    return true
  }

  const range = selection.getRangeAt(selection.rangeCount - 1)
  if (!editor.contains(range.commonAncestorContainer)) {
    editor.append(createPlainTextFragment(editor.ownerDocument, text))
    return true
  }

  range.deleteContents()
  const fragment = createPlainTextFragment(editor.ownerDocument, text)
  const lastNode = fragment.lastChild
  range.insertNode(fragment)

  if (lastNode) {
    const nextRange = editor.ownerDocument.createRange()
    nextRange.setStartAfter(lastNode)
    nextRange.collapse(true)
    selection.removeAllRanges()
    selection.addRange(nextRange)
  }

  return true
}
