export const shouldSyncEditorContent = (activeElement, editor, forceSync = false) => {
  if (!editor) {
    return false
  }

  if (forceSync) {
    return true
  }

  return activeElement !== editor
}
