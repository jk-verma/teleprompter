import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ClipboardEvent,
  type CSSProperties,
} from "react";
import type {
  TeleprompterStatus,
  WorkspaceSettings,
} from "../navbar/navbarSlice";
import { shouldSyncEditorContent } from "./editorSync.js";
import { applySentenceAlignment } from "./alignment.js";
import { applyTextColorToRange } from "./color.js";
import { insertPlainTextAtSelection } from "./paste.js";

type ContentProps = {
  status: TeleprompterStatus;
  scriptHtml: string;
  settings: WorkspaceSettings;
  resetSignal: number;
  syncSignal: number;
  onScriptHtmlChange: (value: string) => void;
};

export type ContentHandle = {
  applyAlignment: (
    alignment: "justifyLeft" | "justifyCenter" | "justifyRight" | "justifyFull",
  ) => boolean;
  applyTextColor: (color: string) => boolean;
  preserveSelection: () => void;
  resetPosition: () => void;
  stopSpeech: () => void;
  toggleSpeech: () => boolean;
};

type SpeechRecognitionConstructor = new () => SpeechRecognition;
type SpeechRecognitionWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

type SpeechWordElement = HTMLSpanElement & {
  dataset: DOMStringMap & {
    speechWord?: string;
    speechWordText?: string;
    wordIndex?: string;
  };
};

const writeStoredScript = (value: string) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem("teleprompter-script", value);
};

export const Content = forwardRef<ContentHandle, ContentProps>(function Content(
  { status, scriptHtml, settings, resetSignal, syncSignal, onScriptHtmlChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const playbackRunRef = useRef(0);
  const frameTimeRef = useRef<number | null>(null);
  const playbackOffsetRef = useRef(0);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastSyncSignalRef = useRef(syncSignal);
  const savedSelectionRangeRef = useRef<Range | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  const speechRestartTimerRef = useRef<number | null>(null);
  const speechWordsRef = useRef<SpeechWordElement[]>([]);
  const speechIndexRef = useRef(0);
  const speechResultIndexRef = useRef(0);
  const isSpeechActiveRef = useRef(false);

  const resetVisualPosition = () => {
    playbackRunRef.current += 1;

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const container = containerRef.current;
    const editor = editorRef.current;

    playbackOffsetRef.current = 0;
    frameTimeRef.current = null;
    savedSelectionRangeRef.current = null;

    if (container) {
      container.scrollTop = 0;
      container.scrollLeft = 0;
    }

    if (editor) {
      editor.style.transform = "";
      editor.style.top = "0px";
      editor.style.position = "relative";
      editor.style.willChange = "";
    }
  };

  const getPlainEditorHtml = () => {
    const editor = editorRef.current;
    if (!editor) {
      return "";
    }

    const clone = editor.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[data-speech-word="true"]').forEach((node) => {
      node.replaceWith(
        editor.ownerDocument.createTextNode(node.textContent ?? ""),
      );
    });
    return clone.innerHTML;
  };

  const saveEditorHtml = () => {
    const html = getPlainEditorHtml().trim();
    const nextValue = html.length > 0 ? getPlainEditorHtml() : "";
    writeStoredScript(nextValue);
    onScriptHtmlChange(nextValue);
  };

  const clearSpeechMarkup = () => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const plainHtml = getPlainEditorHtml();
    editor.innerHTML = plainHtml || "<p><br></p>";
    speechWordsRef.current = [];
  };

  const normalizeSpeechWord = (value: string) =>
    value
      .toLowerCase()
      .replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, "")
      .replace(/[^a-z0-9']+/g, "");

  const tokenizeSpeech = (value: string) =>
    value
      .match(/[A-Za-z0-9']+(?:-[A-Za-z0-9']+)*|[^\sA-Za-z0-9']+/g)
      ?.filter(Boolean) ?? [];

  const editDistance = (left: string, right: string) => {
    if (left === right) {
      return 0;
    }

    if (left.length === 0) {
      return right.length;
    }

    if (right.length === 0) {
      return left.length;
    }

    const previous = new Array(right.length + 1);
    const current = new Array(right.length + 1);
    for (let index = 0; index <= right.length; index += 1) {
      previous[index] = index;
    }

    for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
      current[0] = leftIndex + 1;
      for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
        const insert = current[rightIndex] + 1;
        const remove = previous[rightIndex + 1] + 1;
        const replace =
          previous[rightIndex] +
          (left[leftIndex] === right[rightIndex] ? 0 : 1);
        current[rightIndex + 1] = Math.min(insert, remove, replace);
      }

      for (let index = 0; index <= right.length; index += 1) {
        previous[index] = current[index];
      }
    }

    return previous[right.length];
  };

  const isSpeechMatch = (scriptWord: string, spokenWord: string) => {
    if (!scriptWord || !spokenWord) {
      return false;
    }

    if (scriptWord === spokenWord) {
      return true;
    }

    const distance = editDistance(scriptWord, spokenWord);
    return Math.max(scriptWord.length, spokenWord.length) <= 4
      ? distance <= 1
      : distance <= 2;
  };

  const updateSpeechClasses = () => {
    const words = speechWordsRef.current;
    for (let index = 0; index < words.length; index += 1) {
      const word = words[index];
      word.classList.toggle("speech-processed", index < speechIndexRef.current);
      word.classList.toggle("speech-current", index === speechIndexRef.current);
      word.classList.toggle("speech-pending", index > speechIndexRef.current);
    }

    if (status !== "started") {
      words[speechIndexRef.current]?.scrollIntoView({
        block: "center",
        inline: "nearest",
      });
    }
  };

  const wrapSpeechWords = () => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    clearSpeechMarkup();

    const textNodes: Text[] = [];
    const walker = editor.ownerDocument.createTreeWalker(
      editor,
      NodeFilter.SHOW_TEXT,
    );
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode as Text);
    }

    for (const node of textNodes) {
      const parts = (node.nodeValue ?? "").match(/\s+|[^\s]+/g);
      if (!parts) {
        continue;
      }

      const fragment = editor.ownerDocument.createDocumentFragment();
      for (const part of parts) {
        if (/^\s+$/.test(part)) {
          fragment.append(editor.ownerDocument.createTextNode(part));
          continue;
        }

        const span = editor.ownerDocument.createElement(
          "span",
        ) as SpeechWordElement;
        span.dataset.speechWord = "true";
        span.dataset.speechWordText = part;
        span.className = "speech-word";
        span.textContent = part;
        fragment.append(span);
      }

      node.parentNode?.replaceChild(fragment, node);
    }

    speechWordsRef.current = Array.from(
      editor.querySelectorAll('[data-speech-word="true"]'),
    ) as SpeechWordElement[];
    speechWordsRef.current.forEach((word, index) => {
      word.dataset.wordIndex = String(index);
    });
  };

  const getSelectedWordIndex = () => {
    const editor = editorRef.current;
    if (!editor) {
      return 0;
    }

    const selection = editor.ownerDocument.getSelection();
    if (
      !selection ||
      selection.rangeCount === 0 ||
      !editor.contains(selection.anchorNode)
    ) {
      return 0;
    }

    const anchor =
      selection.anchorNode.nodeType === Node.TEXT_NODE
        ? selection.anchorNode.parentElement
        : selection.anchorNode instanceof Element
          ? selection.anchorNode
          : null;
    const selectedWord = anchor?.closest?.('[data-speech-word="true"]');
    if (selectedWord) {
      const index = Number.parseInt(
        (selectedWord as SpeechWordElement).dataset.wordIndex ?? "0",
        10,
      );
      return Number.isNaN(index) ? 0 : index;
    }

    const range = selection.getRangeAt(0);
    const beforeRange = editor.ownerDocument.createRange();
    beforeRange.selectNodeContents(editor);
    beforeRange.setEnd(range.endContainer, range.endOffset);
    return tokenizeSpeech(beforeRange.toString()).length;
  };

  const setSpeechIndex = (index: number) => {
    const words = speechWordsRef.current;
    speechIndexRef.current = Math.max(0, Math.min(index, words.length));
    updateSpeechClasses();
  };

  const processSpokenText = (value: string) => {
    const words = speechWordsRef.current;
    if (!isSpeechActiveRef.current || !words.length) {
      return;
    }

    const spokenWords = tokenizeSpeech(value)
      .map(normalizeSpeechWord)
      .filter(Boolean);

    for (const spokenWord of spokenWords) {
      if (speechIndexRef.current >= words.length) {
        break;
      }

      let matchedIndex = -1;
      const searchEnd = Math.min(speechIndexRef.current + 14, words.length);
      for (let index = speechIndexRef.current; index < searchEnd; index += 1) {
        if (
          isSpeechMatch(
            normalizeSpeechWord(words[index].dataset.speechWordText ?? ""),
            spokenWord,
          )
        ) {
          matchedIndex = index;
          break;
        }
      }

      if (matchedIndex !== -1) {
        speechIndexRef.current = matchedIndex + 1;
        updateSpeechClasses();
      }
    }
  };

  const stopSpeech = (preserveHighlight = false) => {
    isSpeechActiveRef.current = false;
    const hadSpeechMarkup = speechWordsRef.current.length > 0;

    if (speechRestartTimerRef.current !== null) {
      window.clearTimeout(speechRestartTimerRef.current);
      speechRestartTimerRef.current = null;
    }

    const recognition = speechRecognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      try {
        recognition.abort();
      } catch {
        // Browser implementations can throw if recognition is already closed.
      }
    }
    speechRecognitionRef.current = null;
    editorRef.current?.classList.remove("is-speech-active");

    if (!preserveHighlight && hadSpeechMarkup) {
      clearSpeechMarkup();
      saveEditorHtml();
    }
  };

  const startSpeech = () => {
    const editor = editorRef.current;
    const SpeechRecognitionCtor =
      (window as SpeechRecognitionWindow).SpeechRecognition ??
      (window as SpeechRecognitionWindow).webkitSpeechRecognition;

    if (!editor || !SpeechRecognitionCtor || isSpeechActiveRef.current) {
      return false;
    }

    const startingIndex = getSelectedWordIndex();
    wrapSpeechWords();
    setSpeechIndex(startingIndex);
    saveEditorHtml();

    const recognition = new SpeechRecognitionCtor();
    speechRecognitionRef.current = recognition;
    speechResultIndexRef.current = 0;
    isSpeechActiveRef.current = true;
    editor.classList.add("is-speech-active");

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      if (!isSpeechActiveRef.current) {
        return;
      }

      for (
        let index = Math.max(event.resultIndex, speechResultIndexRef.current);
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index];
        if (result.isFinal) {
          processSpokenText(result[0].transcript);
          speechResultIndexRef.current = index + 1;
        }
      }
    };
    recognition.onerror = () => {
      stopSpeech(true);
    };
    recognition.onend = () => {
      if (!isSpeechActiveRef.current) {
        return;
      }

      speechRestartTimerRef.current = window.setTimeout(() => {
        try {
          recognition.start();
        } catch {
          stopSpeech(true);
        }
      }, 120);
    };

    try {
      recognition.start();
      return true;
    } catch {
      stopSpeech();
      return false;
    }
  };

  const toggleSpeech = () => {
    if (isSpeechActiveRef.current) {
      stopSpeech();
      return false;
    }

    return startSpeech();
  };

  const handleWordClick = (event: MouseEvent) => {
    if (!isSpeechActiveRef.current) {
      return;
    }

    const target = event.target;
    const word =
      target instanceof Element
        ? (target.closest('[data-speech-word="true"]') as
            | SpeechWordElement
            | null)
        : null;
    if (!word) {
      return;
    }

    const index = Number.parseInt(word.dataset.wordIndex ?? "0", 10);
    if (!Number.isNaN(index)) {
      setSpeechIndex(index);
    }
  };

  const snapshotSelection = () => {
    const editor = editorRef.current;
    const selection = editor?.ownerDocument.getSelection();
    if (
      !editor ||
      !selection ||
      selection.rangeCount === 0 ||
      !editor.contains(selection.anchorNode)
    ) {
      return;
    }

    savedSelectionRangeRef.current = selection
      .getRangeAt(selection.rangeCount - 1)
      .cloneRange();
  };

  useEffect(() => {
    stopSpeech();
    resetVisualPosition();

    const frame = requestAnimationFrame(resetVisualPosition);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [resetSignal]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const forceSync = lastSyncSignalRef.current !== syncSignal;
    lastSyncSignalRef.current = syncSignal;

    if (!shouldSyncEditorContent(document.activeElement, editor, forceSync)) {
      return;
    }

    if (editor.innerHTML !== scriptHtml) {
      editor.innerHTML = scriptHtml || "<p><br></p>";
      resetVisualPosition();
    }
  }, [scriptHtml, syncSignal]);

  useEffect(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const container = containerRef.current;
    const editor = editorRef.current;

    if (!container || !editor || status !== "started") {
      return;
    }

    const playbackRun = (playbackRunRef.current += 1);
    playbackOffsetRef.current = Math.max(playbackOffsetRef.current, 0);
    editor.style.willChange = "top";

    const animate = (timestamp: number) => {
      if (playbackRun !== playbackRunRef.current) {
        return;
      }

      const currentContainer = containerRef.current;
      const currentEditor = editorRef.current;

      if (!currentContainer || !currentEditor) {
        return;
      }

      const previousTime = frameTimeRef.current;
      frameTimeRef.current = timestamp;

      const elapsedSeconds =
        previousTime === null
          ? 0
          : Math.max((timestamp - previousTime) / 1000, 0);
      const pixelsPerSecond = Math.max(18, settings.speed * 2.2);
      playbackOffsetRef.current += elapsedSeconds * pixelsPerSecond;

      currentContainer.scrollTop = playbackOffsetRef.current;
      currentEditor.style.position = "relative";
      currentEditor.style.top = `-${playbackOffsetRef.current}px`;

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      playbackRunRef.current += 1;
      frameTimeRef.current = null;
      if (editor) {
        editor.style.willChange = "";
      }
    };
  }, [settings.speed, status]);

  const style: CSSProperties & Record<string, string> = {
    fontSize: `${settings.fontSize}px`,
    paddingLeft: `${settings.margin}px`,
    paddingRight: `${settings.margin}px`,
    paddingTop: 0,
    paddingBottom: 0,
    backgroundColor: settings.backgroundColor,
    ["--script-text-color" as string]: "#f8fbff",
    ["--script-background-color" as string]: settings.backgroundColor,
  };

  const handleInput = () => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    saveEditorHtml();
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const editor = editorRef.current;
    const text = event.clipboardData.getData("text/plain");
    if (!editor || !text) {
      return;
    }

    event.preventDefault();
    insertPlainTextAtSelection(editor, text);
    saveEditorHtml();
    snapshotSelection();
  };

  const getSelectedRange = () => {
    const editor = editorRef.current;
    const selection = editor?.ownerDocument.getSelection();
    return (
      selection &&
      selection.rangeCount > 0 &&
      editor.contains(selection.anchorNode)
        ? selection.getRangeAt(selection.rangeCount - 1)
        : savedSelectionRangeRef.current
    );
  };

  const saveCurrentEditorHtml = () => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const html = editor.innerHTML.trim();
    const nextValue = html.length > 0 ? editor.innerHTML : "";
    writeStoredScript(nextValue);
    onScriptHtmlChange(nextValue);
  };

  useImperativeHandle(ref, () => ({
    applyAlignment(alignment) {
      const editor = editorRef.current;
      if (!editor) {
        return false;
      }

      const applied = applySentenceAlignment(
        editor,
        alignment,
        savedSelectionRangeRef.current,
      );
      if (!applied) {
        return false;
      }

      const html = editor.innerHTML.trim();
      const nextValue = html.length > 0 ? editor.innerHTML : "";
      writeStoredScript(nextValue);
      onScriptHtmlChange(nextValue);
      return true;
    },
    applyTextColor(color) {
      const editor = editorRef.current;
      if (!editor) {
        return false;
      }

      const nextRange = applyTextColorToRange(editor, getSelectedRange(), color);
      if (!nextRange) {
        return false;
      }

      const selection = editor.ownerDocument.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(nextRange);
      savedSelectionRangeRef.current = nextRange.cloneRange();

      saveCurrentEditorHtml();
      return true;
    },
    preserveSelection() {
      snapshotSelection();
    },
    resetPosition() {
      const container = containerRef.current;
      const editor = editorRef.current;
      stopSpeech();
      resetVisualPosition();
      requestAnimationFrame(resetVisualPosition);

      if (editor) {
        editor.scrollIntoView({ block: "start", inline: "nearest" });
      }
      container?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    },
    stopSpeech() {
      stopSpeech();
    },
    toggleSpeech() {
      return toggleSpeech();
    },
  }));

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const handleSelectionChange = () => {
      snapshotSelection();
    };

    editor.addEventListener("pointerup", snapshotSelection);
    editor.addEventListener("click", handleWordClick);
    editor.addEventListener("mouseup", snapshotSelection);
    editor.addEventListener("keyup", snapshotSelection);
    editor.addEventListener("input", snapshotSelection);
    editor.ownerDocument.addEventListener(
      "selectionchange",
      handleSelectionChange,
    );
    return () => {
      editor.removeEventListener("pointerup", snapshotSelection);
      editor.removeEventListener("click", handleWordClick);
      editor.removeEventListener("mouseup", snapshotSelection);
      editor.removeEventListener("keyup", snapshotSelection);
      editor.removeEventListener("input", snapshotSelection);
      editor.ownerDocument.removeEventListener(
        "selectionchange",
        handleSelectionChange,
      );
    };
  }, []);

  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, []);

  return (
    <main className="content-area">
      <div
        className="content teleprompter-display"
        ref={containerRef}
        style={style}
      >
        <div
          ref={editorRef}
          className="teleprompter-copy teleprompter-editor"
          contentEditable
          role="textbox"
          aria-multiline="true"
          spellCheck
          dir="ltr"
          suppressContentEditableWarning
          onInput={handleInput}
          onPaste={handlePaste}
        />
      </div>
    </main>
  );
});
