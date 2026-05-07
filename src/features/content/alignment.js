const BLOCK_SELECTOR =
  "p, div, li, blockquote, section, article, h1, h2, h3, h4, h5, h6, pre";

const ALIGNMENT_TO_TEXT_ALIGN = {
  justifyLeft: "left",
  justifyCenter: "center",
  justifyRight: "right",
  justifyFull: "justify",
};

const SENTENCE_ALIGN_ATTRIBUTE = "data-sentence-align";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const isTextNode = (node) => node && node.nodeType === Node.TEXT_NODE;

const getBlockFromNode = (root, node) => {
  if (!node) {
    return root;
  }

  const element =
    node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  const block = element?.closest(BLOCK_SELECTOR);
  return block && root.contains(block) ? block : root;
};

const flattenTextNodes = (root) => {
  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
  );
  const nodes = [];
  let textLength = 0;

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const value = node.nodeValue ?? "";
    if (!value) {
      continue;
    }

    nodes.push({
      node,
      start: textLength,
      end: textLength + value.length,
    });
    textLength += value.length;
  }

  return { nodes, text: root.textContent ?? "" };
};

const locateTextPosition = (nodes, offset) => {
  if (!nodes.length) {
    return null;
  }

  const boundedOffset = clamp(offset, 0, nodes[nodes.length - 1].end);

  for (const entry of nodes) {
    if (boundedOffset <= entry.end) {
      return {
        node: entry.node,
        offset: boundedOffset - entry.start,
      };
    }
  }

  const last = nodes[nodes.length - 1];
  return {
    node: last.node,
    offset: last.node.nodeValue?.length ?? 0,
  };
};

const getCaretOffsetInRoot = (root, container, offset) => {
  const range = root.ownerDocument.createRange();
  range.selectNodeContents(root);

  try {
    range.setEnd(container, offset);
  } catch {
    range.collapse(true);
  }

  return range.toString().length;
};

const findSentenceBounds = (text, caretOffset) => {
  if (!text) {
    return null;
  }

  const boundedCaret = clamp(caretOffset, 0, text.length);
  let start = 0;
  let end = text.length;

  for (let index = boundedCaret - 1; index >= 0; index -= 1) {
    if (/[.!?\n]/.test(text[index])) {
      start = index + 1;
      break;
    }
  }

  for (let index = boundedCaret; index < text.length; index += 1) {
    if (/[.!?\n]/.test(text[index])) {
      end = index + 1;
      break;
    }
  }

  while (start < text.length && /\s/.test(text[start])) {
    start += 1;
  }

  while (end > start && /\s/.test(text[end - 1])) {
    end -= 1;
  }

  if (end <= start) {
    return null;
  }

  return { start, end };
};

const getExistingSentenceWrapper = (node) => {
  const element = node && (isTextNode(node) ? node.parentElement : node);
  const wrapper = element?.closest?.(`[${SENTENCE_ALIGN_ATTRIBUTE}="true"]`);
  return wrapper ?? null;
};

const styleSentenceWrapper = (wrapper, alignment) => {
  wrapper.dataset.align = alignment;
  wrapper.setAttribute(SENTENCE_ALIGN_ATTRIBUTE, "true");
  wrapper.style.display = "inline-block";
  wrapper.style.width = "100%";
  wrapper.style.verticalAlign = "top";
  wrapper.style.textAlign = ALIGNMENT_TO_TEXT_ALIGN[alignment] ?? "left";
};

export const applySentenceAlignment = (
  editor,
  alignment,
  selectionRange = null,
) => {
  if (!editor || !editor.ownerDocument) {
    return false;
  }

  const selection = editor.ownerDocument.getSelection();
  if (!selectionRange && (!selection || selection.rangeCount === 0)) {
    return false;
  }

  const activeRange =
    selectionRange ?? selection.getRangeAt(selection.rangeCount - 1);
  if (!activeRange || !editor.contains(activeRange.startContainer)) {
    return false;
  }

  const focusNode = activeRange.endContainer;
  const block = getBlockFromNode(editor, focusNode);
  const existingWrapper = getExistingSentenceWrapper(focusNode);
  const targetRange = editor.ownerDocument.createRange();

  const { nodes, text } = flattenTextNodes(block);
  if (!nodes.length || !text.trim()) {
    return false;
  }

  const caretOffset = getCaretOffsetInRoot(
    block,
    activeRange.endContainer,
    activeRange.endOffset,
  );
  const bounds = findSentenceBounds(text, caretOffset);
  if (!bounds) {
    return false;
  }

  const start = locateTextPosition(nodes, bounds.start);
  const end = locateTextPosition(nodes, bounds.end);
  if (!start || !end) {
    return false;
  }

  targetRange.setStart(start.node, start.offset);
  targetRange.setEnd(end.node, end.offset);

  const targetText = targetRange.toString().replace(/\s+/g, " ").trim();
  const existingText =
    existingWrapper?.textContent?.replace(/\s+/g, " ").trim() ?? "";

  if (
    existingWrapper &&
    editor.contains(existingWrapper) &&
    existingText === targetText
  ) {
    styleSentenceWrapper(existingWrapper, alignment);
    if (selection) {
      selection.removeAllRanges();
      targetRange.selectNodeContents(existingWrapper);
      targetRange.collapse(false);
      selection.addRange(targetRange);
    }
    editor.focus();
    return true;
  }

  if (existingWrapper && editor.contains(existingWrapper)) {
    const fragment = editor.ownerDocument.createDocumentFragment();
    while (existingWrapper.firstChild) {
      fragment.append(existingWrapper.firstChild);
    }
    existingWrapper.replaceWith(fragment);
  }

  const fragment = targetRange.extractContents();
  const wrapper = editor.ownerDocument.createElement("span");
  styleSentenceWrapper(wrapper, alignment);
  wrapper.append(fragment);
  targetRange.insertNode(wrapper);

  if (selection) {
    targetRange.selectNodeContents(wrapper);
    targetRange.collapse(false);
    selection.removeAllRanges();
    selection.addRange(targetRange);
  }
  editor.focus();
  return true;
};
