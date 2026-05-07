import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import React from "react";
import { createRoot } from "react-dom/client";
import { createServer } from "vite";
import { JSDOM } from "jsdom";

const navbarSource = readFileSync(
  new URL("../src/features/navbar/NavBar.tsx", import.meta.url),
  "utf8",
);
const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const contentSource = readFileSync(
  new URL("../src/features/content/Content.tsx", import.meta.url),
  "utf8",
);
const stylesSource = readFileSync(
  new URL("../src/index.scss", import.meta.url),
  "utf8",
);
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

test("toolbar buttons are wired to active handlers", () => {
  const requiredHandlers = [
    "onClick={onOpenFile}",
    "onClick={onSaveFile}",
    "onClick={onResetPosition}",
    "onClick={onToggleFullscreen}",
    "onClick={onToggleInstructions}",
    "onClick={onTogglePlayback}",
    "onClick={onToggleSpeech}",
  ];

  for (const handler of requiredHandlers) {
    assert.match(navbarSource, new RegExp(handler.replace(/[{}]/g, "\\$&")));
  }
});

test("return to beginning invalidates pending playback frames", () => {
  assert.match(contentSource, /const playbackRunRef = useRef\(0\)/);
  assert.match(contentSource, /playbackRunRef\.current \+= 1;/);
  assert.match(contentSource, /const playbackRun = \(playbackRunRef\.current \+= 1\);/);
  assert.match(contentSource, /playbackRun !== playbackRunRef\.current/);
  assert.match(contentSource, /editor\.style\.top = "";/);
  assert.doesNotMatch(contentSource, /currentEditor\.style\.top = `-\$\{playbackOffsetRef\.current\}px`;/);
  assert.match(contentSource, /const moveCaretToEditorStart = \(\) =>/);
  assert.match(contentSource, /const scrollToStart = \(\) =>/);
  assert.match(contentSource, /container\.scrollTop = 0;/);
  assert.match(contentSource, /container\.scrollLeft = 0;/);
  assert.match(contentSource, /let ancestor = container\.parentElement;/);
  assert.match(contentSource, /ancestor\.scrollTop = 0;/);
  assert.match(contentSource, /const getPlaybackScrollTarget = \(\) =>/);
  assert.match(contentSource, /container\.scrollHeight > container\.clientHeight \+ 1/);
  assert.match(contentSource, /scrollTarget\.scrollTop = playbackOffsetRef\.current;/);
  assert.match(contentSource, /scrollingElement/);
  assert.match(contentSource, /win\?\.scrollTo\?\.\(0, 0\);/);
  assert.match(contentSource, /range\.collapse\(true\);/);
  assert.match(contentSource, /const resetToBeginning = \(\) =>/);
  assert.match(contentSource, /resetVisualPosition\(true\);/);
  assert.match(contentSource, /requestAnimationFrame\(\(\) => \{[\s\S]*requestAnimationFrame\(\(\) => \{/);
});

test("alignment popover buttons are wired to alignment commands", () => {
  const requiredCommands = [
    "justifyLeft",
    "justifyCenter",
    "justifyRight",
    "justifyFull",
  ];

  assert.match(
    navbarSource,
    /onClick=\{\(\) => applyAlignment\(option.command\)\}/,
  );

  for (const command of requiredCommands) {
    assert.match(navbarSource, new RegExp(command));
  }
});

test("microphone button is restored and wired to speech processing", () => {
  assert.match(navbarSource, /fa-microphone/);
  assert.match(navbarSource, /data-testid="toolbar-mic"/);
  assert.doesNotMatch(navbarSource, /disabled\s+title=/);
});

test("text color control uses safe in-app palette buttons", () => {
  assert.match(navbarSource, /TEXT_COLOR_OPTIONS/);
  assert.match(navbarSource, /data-testid="toolbar-font-color"/);
  assert.match(navbarSource, /data-testid=\{`toolbar-text-color-/);
  assert.match(navbarSource, /onPrepareTextColor\(\);/);
  assert.doesNotMatch(
    navbarSource,
    /data-testid="toolbar-font-color"[\s\S]{0,120}type="color"/,
  );
});

test("margin slider applies symmetrical in-bounds editor margins", () => {
  assert.match(navbarSource, /const MAX_MARGIN = 560/);
  assert.match(navbarSource, /\(settings\.margin \/ MAX_MARGIN\) \* 200/);
  assert.match(navbarSource, /max=\{MAX_MARGIN\}/);
  assert.match(contentSource, /paddingLeft:\s*`\$\{settings\.margin\}px`/);
  assert.match(contentSource, /paddingRight:\s*`\$\{settings\.margin\}px`/);
  assert.match(stylesSource, /\.teleprompter-display\s*\{[\s\S]*box-sizing:\s*border-box;/);
  assert.match(stylesSource, /\.teleprompter-editor\s*\{[\s\S]*max-width:\s*100%;/);
});

test("toolbar has mobile responsive wrapping rules", () => {
  assert.match(stylesSource, /min-height:\s*100dvh/);
  assert.match(stylesSource, /@media\s*\(max-width:\s*1080px\)\s*\{[\s\S]*\.site-header-main\s*\{[\s\S]*flex-wrap:\s*wrap;/);
  assert.match(stylesSource, /@media\s*\(max-width:\s*760px\)\s*\{[\s\S]*\.topbar-actions\s*\{[\s\S]*flex:\s*1 1 100%;/);
  assert.match(stylesSource, /@media\s*\(max-width:\s*480px\)\s*\{[\s\S]*\.topbar-tuners-stack\s*\{[\s\S]*flex:\s*1 1 calc\(100% - 4\.2rem\);/);
});

test("toolbar header can be hidden and restored", () => {
  assert.match(appSource, /isToolbarHidden/);
  assert.match(appSource, /data-testid="toolbar-hide"/);
  assert.match(appSource, />Hide Toolbar</);
  assert.match(appSource, /data-testid="toolbar-show"/);
  assert.match(appSource, /hidden=\{isToolbarHidden\}/);
  assert.match(stylesSource, /\.site-header\[hidden\]\s*\{[\s\S]*display:\s*none;/);
  assert.match(stylesSource, /\.toolbar-visibility-button\s*\{[\s\S]*flex:\s*0 0 auto;/);
  assert.match(stylesSource, /\.toolbar-visibility-button\s*\{[\s\S]*min-width:\s*7\.35rem;/);
  assert.match(stylesSource, /\.toolbar-restore-button\s*\{[\s\S]*position:\s*fixed;/);
  assert.match(stylesSource, /\.is-toolbar-hidden \.content\s*\{[\s\S]*min-height:\s*calc\(100dvh - 0\.5rem\);/);
});

test("toolbar buttons call their assigned functions", async () => {
  const vite = await createServer({
    configFile: false,
    root: repoRoot,
    plugins: [react()],
    optimizeDeps: { entries: [] },
    server: { middlewareMode: true },
  });

  const dom = new JSDOM('<div id="root"></div>', {
    url: "https://example.test/",
    pretendToBeVisual: true,
  });

  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousNode = globalThis.Node;
  const previousHTMLElement = globalThis.HTMLElement;
  const previousPointerEvent = globalThis.PointerEvent;

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Node = dom.window.Node;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.PointerEvent = dom.window.PointerEvent;

  try {
    const { NavBar } = await vite.ssrLoadModule(
      "/src/features/navbar/NavBar.tsx",
    );
    const calls = [];
    const rootElement = dom.window.document.getElementById("root");
    const root = createRoot(rootElement);

    root.render(
      React.createElement(NavBar, {
        status: "stopped",
        settings: {
          fontSize: 60,
          speed: 35,
          margin: 16,
          fontColor: "#ffffff",
          backgroundColor: "#000000",
        },
        onSetFontSize: (value) => calls.push(["fontSize", value]),
        onSetSpeed: (value) => calls.push(["speed", value]),
        onSetMargin: (value) => calls.push(["margin", value]),
        onSetFontColor: (value) => calls.push(["fontColor", value]),
        onPrepareTextColor: () => calls.push(["prepareTextColor"]),
        onSetBackgroundColor: (value) => calls.push(["backgroundColor", value]),
        onToggleFullscreen: () => calls.push(["fullscreen"]),
        isFullscreen: false,
        isInstructionsOpen: false,
        onToggleInstructions: () => calls.push(["instructions"]),
        onTogglePlayback: () => calls.push(["playback"]),
        isMicActive: false,
        onToggleSpeech: () => calls.push(["speech"]),
        onOpenFile: () => calls.push(["open"]),
        onSaveFile: () => calls.push(["save"]),
        onResetPosition: () => calls.push(["reset"]),
        onApplyAlignment: (value) => calls.push(["align", value]),
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    for (const id of [
      "toolbar-open",
      "toolbar-save",
      "toolbar-reset",
      "toolbar-fullscreen",
      "toolbar-instructions",
      "toolbar-mic",
      "toolbar-play",
    ]) {
      dom.window.document.querySelector(`[data-testid="${id}"]`).click();
    }

    dom.window.document.querySelector('[data-testid="toolbar-align"]').click();
    dom.window.document
      .querySelector('[data-testid="toolbar-justifyCenter"]')
      .click();
    const textColorButton = dom.window.document.querySelector(
      '[data-testid="toolbar-font-color"]',
    );
    textColorButton.dispatchEvent(
      new dom.window.MouseEvent("mousedown", { bubbles: true }),
    );
    textColorButton.click();

    const redSwatch = dom.window.document.querySelector(
      '[data-testid="toolbar-text-color-ff4040"]',
    );
    redSwatch.dispatchEvent(
      new dom.window.MouseEvent("mousedown", { bubbles: true }),
    );
    redSwatch.click();

    assert.deepEqual(calls, [
      ["open"],
      ["save"],
      ["reset"],
      ["fullscreen"],
      ["instructions"],
      ["speech"],
      ["playback"],
      ["align", "justifyCenter"],
      ["prepareTextColor"],
      ["prepareTextColor"],
      ["fontColor", "#ff4040"],
    ]);

    root.unmount();
  } finally {
    await vite.close();
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    globalThis.Node = previousNode;
    globalThis.HTMLElement = previousHTMLElement;
    globalThis.PointerEvent = previousPointerEvent;
  }
});
