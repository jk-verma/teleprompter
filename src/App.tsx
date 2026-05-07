import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { HomePage } from "./features/home/HomePage";
import { normalizeImportedScript } from "./lib/scriptImport.js";
import {
  DEFAULT_WORKSPACE_SETTINGS,
  type TeleprompterStatus,
  type WorkspaceSettings,
  writeWorkspaceSettings,
  readWorkspaceSettings,
} from "./features/navbar/navbarSlice";
import { NavBar } from "./features/navbar/NavBar";
import type { ContentHandle } from "./features/content/Content";
import { TeleprompterPage } from "./features/teleprompter/TeleprompterPage";

type AppRoute = "home" | "readme";

const FALLBACK_SCRIPT = `<p>Welcome to the Teleprompter.</p><p>It can process your text and voice both.</p><p>Edit this area to change the default script that loads for new sessions.</p><p>Your last saved script is remembered in the browser, so refreshing the page keeps your working content in place.</p><p>You can still add inline notes like [pause] or [look at camera] and they will remain visible without affecting speech matching.</p>`;

const getRouteFromHash = (): AppRoute =>
  window.location.hash === "#/readme" ? "readme" : "home";

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const SCRIPT_STORAGE_KEY = "teleprompter-script";

const readStoredScript = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(SCRIPT_STORAGE_KEY);
  return stored === null ? null : stored;
};

const writeStoredScript = (value: string) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SCRIPT_STORAGE_KEY, value);
};

const readFileText = async (file: File) => {
  try {
    return await file.text();
  } catch {
    const buffer = await file.arrayBuffer();
    return new TextDecoder("utf-8").decode(buffer);
  }
};

const App = () => {
  const [route, setRoute] = useState<AppRoute>(getRouteFromHash);
  const [status, setStatus] = useState<TeleprompterStatus>("stopped");
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>(
    () => readWorkspaceSettings() ?? DEFAULT_WORKSPACE_SETTINGS,
  );
  const [selectedTextColor, setSelectedTextColor] = useState(
    () =>
      readWorkspaceSettings()?.fontColor ?? DEFAULT_WORKSPACE_SETTINGS.fontColor,
  );
  const [scriptHtml, setScriptHtml] = useState<string>(
    () => readStoredScript() ?? FALLBACK_SCRIPT,
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [isToolbarHidden, setIsToolbarHidden] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [syncSignal, setSyncSignal] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const contentRef = useRef<ContentHandle | null>(null);

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(getRouteFromHash());
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  useEffect(() => {
    const updateFullscreenState = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", updateFullscreenState);
    updateFullscreenState();

    return () => {
      document.removeEventListener("fullscreenchange", updateFullscreenState);
    };
  }, []);

  useEffect(() => {
    writeWorkspaceSettings(workspaceSettings);
  }, [workspaceSettings]);

  useEffect(() => {
    writeStoredScript(scriptHtml);
  }, [scriptHtml]);

  const toggleInstructions = () => {
    window.location.hash = route === "home" ? "#/readme" : "#/";
  };

  const stopPlayback = () => {
    if (status === "started") {
      setStatus("stopped");
    }
  };

  const startPlayback = () => {
    contentRef.current?.stopSpeech();
    setIsMicActive(false);
    if (status === "stopped") {
      setStatus("started");
    }
  };

  const togglePlayback = () => {
    if (status === "started") {
      stopPlayback();
      return;
    }

    startPlayback();
  };

  const updateSetting = <K extends keyof WorkspaceSettings>(
    key: K,
    value: WorkspaceSettings[K],
  ) => {
    setWorkspaceSettings((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const applySelectedTextColor = (value: string) => {
    setSelectedTextColor(value);
    contentRef.current?.applyTextColor(value);
  };

  const preserveEditorSelection = () => {
    contentRef.current?.preserveSelection();
  };

  const resetPosition = () => {
    setStatus("stopped");
    setIsMicActive(false);
    contentRef.current?.resetPosition();
    setResetSignal((previous) => previous + 1);
  };

  const toggleSpeech = () => {
    setStatus("stopped");
    const nextMicState = contentRef.current?.toggleSpeech() ?? false;
    setIsMicActive(nextMicState);
  };

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await document.documentElement.requestFullscreen();
  };

  const openFile = () => {
    const input = fileInputRef.current;
    if (!input) {
      return;
    }

    input.value = "";
    input.click();
  };

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    try {
      const text = await readFileText(file);
      contentRef.current?.stopSpeech();
      setIsMicActive(false);
      setScriptHtml(normalizeImportedScript(text, file.name, file.type));
      setSyncSignal((previous) => previous + 1);
      setStatus("stopped");
    } catch (error) {
      console.error("Failed to import file", error);
    }
  };

  const saveFile = () => {
    const latestScript = readStoredScript() ?? scriptHtml;
    const blob = new Blob([latestScript], { type: "text/html;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = "teleprompter-script.html";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  };

  const applyAlignment = (
    alignment: "justifyLeft" | "justifyCenter" | "justifyRight" | "justifyFull",
  ) => {
    return contentRef.current?.applyAlignment(alignment) ?? false;
  };

  return (
    <div
      className={`app-shell app-shell-app ${isToolbarHidden ? "is-toolbar-hidden" : ""}`}
    >
      <header className="site-header" hidden={isToolbarHidden}>
        <div className="site-header-main">
          <div className="site-brand-row">
            <a className="site-brand" href="#/" aria-label="TelePrompter home">
              <span className="site-brand-mark">T</span>
              <span>
                <strong>TelePrompter</strong>
              </span>
            </a>
          </div>

          <span className="site-header-separator" aria-hidden="true" />

          {route === "home" ? (
            <NavBar
              status={status}
              settings={{ ...workspaceSettings, fontColor: selectedTextColor }}
              onSetFontSize={(value) => updateSetting("fontSize", value)}
              onSetSpeed={(value) => updateSetting("speed", value)}
              onSetMargin={(value) => updateSetting("margin", value)}
              onSetFontColor={applySelectedTextColor}
              onPrepareTextColor={preserveEditorSelection}
              onSetBackgroundColor={(value) =>
                updateSetting("backgroundColor", value)
              }
              onToggleFullscreen={toggleFullscreen}
              isFullscreen={isFullscreen}
              isInstructionsOpen={route === "readme"}
              onToggleInstructions={toggleInstructions}
              onTogglePlayback={togglePlayback}
              isMicActive={isMicActive}
              onToggleSpeech={toggleSpeech}
              onOpenFile={openFile}
              onSaveFile={saveFile}
              onResetPosition={resetPosition}
              onApplyAlignment={applyAlignment}
            />
          ) : null}

          <button
            type="button"
            className="toolbar-visibility-button"
            onClick={() => setIsToolbarHidden(true)}
            title="Hide toolbar header"
            aria-label="Hide toolbar header"
            data-testid="toolbar-hide"
          >
            <span className="icon is-small" aria-hidden="true">
              <i className="fa-solid fa-chevron-up" />
            </span>
          </button>

          <a
            className="support-link"
            href="https://github.com/sponsors/jk-verma"
            target="_blank"
            rel="noreferrer"
            aria-label="Support the Project"
          >
            <span className="icon is-small" aria-hidden="true">
              <i className="fa-regular fa-heart" />
            </span>
            <span>Support the Project</span>
          </a>
        </div>
      </header>

      {isToolbarHidden ? (
        <button
          type="button"
          className="toolbar-restore-button"
          onClick={() => setIsToolbarHidden(false)}
          title="Show toolbar header"
          aria-label="Show toolbar header"
          data-testid="toolbar-show"
        >
          <span className="icon is-small" aria-hidden="true">
            <i className="fa-solid fa-chevron-down" />
          </span>
          <span>Toolbar</span>
        </button>
      ) : null}

      <div className="page-content">
        {route === "readme" ? (
          <HomePage />
        ) : (
          <TeleprompterPage
            ref={contentRef}
            status={status}
            settings={workspaceSettings}
            scriptHtml={scriptHtml}
            resetSignal={resetSignal}
            syncSignal={syncSignal}
            onScriptHtmlChange={setScriptHtml}
          />
        )}
      </div>

      <input
        id="teleprompter-file-input"
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.html,.htm,.xhtml,.json,.csv,text/plain,text/markdown,text/x-markdown,text/html,application/json,application/xhtml+xml,text/csv"
        className="teleprompter-file-input"
        onChange={handleFileSelected}
      />
    </div>
  );
};

export default App;
