export const getRangeInsideEditor = (editor, range) => {
  if (!editor || !range || range.collapsed) {
    return null
  }

  const root = range.commonAncestorContainer
  const rootElement = root.nodeType === 3 ? root.parentElement : root

  return rootElement && (rootElement === editor || editor.contains(rootElement))
    ? range.cloneRange()
    : null
}

export const applyTextColorToRange = (editor, range, color) => {
  const editableRange = getRangeInsideEditor(editor, range)
  if (!editableRange) {
    return null
  }

  const selectedContent = editableRange.extractContents()
  const span = editor.ownerDocument.createElement("span")
  span.style.color = color
  span.append(selectedContent)
  editableRange.insertNode(span)

  const nextRange = editor.ownerDocument.createRange()
  nextRange.selectNodeContents(span)
  return nextRange
}
