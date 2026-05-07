import { useEffect, useRef, useState } from "react";
import type { TeleprompterStatus, WorkspaceSettings } from "./navbarSlice";

type AlignmentCommand =
  | "justifyLeft"
  | "justifyCenter"
  | "justifyRight"
  | "justifyFull";

type NavBarProps = {
  status: TeleprompterStatus;
  settings: WorkspaceSettings;
  onSetFontSize: (value: number) => void;
  onSetSpeed: (value: number) => void;
  onSetMargin: (value: number) => void;
  onSetFontColor: (value: string) => void;
  onPrepareTextColor: () => void;
  onSetBackgroundColor: (value: string) => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  isInstructionsOpen: boolean;
  onToggleInstructions: () => void;
  onTogglePlayback: () => void;
  isMicActive: boolean;
  onToggleSpeech: () => void;
  onOpenFile: () => void;
  onSaveFile: () => void;
  onResetPosition: () => void;
  onApplyAlignment: (value: AlignmentCommand) => void;
};

const ALIGNMENT_OPTIONS: Array<{
  command: AlignmentCommand;
  icon: string;
  label: string;
}> = [
  { command: "justifyLeft", icon: "fa-align-left", label: "Align left" },
  { command: "justifyCenter", icon: "fa-align-center", label: "Align center" },
  { command: "justifyRight", icon: "fa-align-right", label: "Align right" },
  { command: "justifyFull", icon: "fa-align-justify", label: "Justify" },
];

const TEXT_COLOR_OPTIONS = [
  "#f8fbff",
  "#ff4040",
  "#ffd43b",
  "#51cf66",
  "#38d9a9",
  "#4dabf7",
  "#cc5de8",
  "#ff922b",
];

const MAX_MARGIN = 560;

export const NavBar = ({
  status,
  settings,
  onSetFontSize,
  onSetSpeed,
  onSetMargin,
  onSetFontColor,
  onPrepareTextColor,
  onSetBackgroundColor,
  onToggleFullscreen,
  isFullscreen,
  isInstructionsOpen,
  onToggleInstructions,
  onTogglePlayback,
  isMicActive,
  onToggleSpeech,
  onOpenFile,
  onSaveFile,
  onResetPosition,
  onApplyAlignment,
}: NavBarProps) => {
  const isPlaying = status === "started";
  const marginPercent = Math.round((settings.margin / MAX_MARGIN) * 200);
  const [isAlignmentMenuOpen, setIsAlignmentMenuOpen] = useState(false);
  const [isTextColorMenuOpen, setIsTextColorMenuOpen] = useState(false);
  const alignmentMenuRef = useRef<HTMLDivElement | null>(null);
  const textColorMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const menu = alignmentMenuRef.current;
      if (menu && !menu.contains(event.target as Node)) {
        setIsAlignmentMenuOpen(false);
      }

      const textMenu = textColorMenuRef.current;
      if (textMenu && !textMenu.contains(event.target as Node)) {
        setIsTextColorMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  const applyAlignment = (command: AlignmentCommand) => {
    onApplyAlignment(command);
    setIsAlignmentMenuOpen(false);
  };

  const applyTextColor = (color: string) => {
    onSetFontColor(color);
    setIsTextColorMenuOpen(false);
  };

  return (
    <div className="topbar-controls" aria-label="TelePrompter controls">
      <div className="topbar-right-controls">
        <div className="topbar-color-stack topbar-inline-controls">
          <div
            className="topbar-slider-text topbar-color-label topbar-text-color-menu"
            ref={textColorMenuRef}
          >
            <span>Text</span>
            <button
              type="button"
              className="topbar-color-button"
              style={{ backgroundColor: settings.fontColor }}
              onMouseDown={(event) => {
                event.preventDefault();
                onPrepareTextColor();
              }}
              onClick={() => setIsTextColorMenuOpen((previous) => !previous)}
              aria-expanded={isTextColorMenuOpen}
              aria-label="Choose selected text color"
              data-testid="toolbar-font-color"
            >
              <span className="is-sr-only">Choose selected text color</span>
            </button>

            <div
              className="topbar-color-popover"
              hidden={!isTextColorMenuOpen}
            >
              {TEXT_COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="topbar-color-swatch"
                  style={{ backgroundColor: color }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onPrepareTextColor();
                  }}
                  onClick={() => applyTextColor(color)}
                  aria-label={`Apply text color ${color}`}
                  data-testid={`toolbar-text-color-${color.slice(1)}`}
                />
              ))}
            </div>
          </div>

          <label className="topbar-slider-text topbar-color-label">
            <span>BG</span>
            <input
              type="color"
              value={settings.backgroundColor}
              onChange={(event) =>
                onSetBackgroundColor(event.currentTarget.value)
              }
              data-testid="toolbar-background-color"
            />
          </label>
        </div>

        <div className="topbar-tuners-stack topbar-right-controls-group">
          <div className="topbar-slider-row">
            <span className="topbar-slider-text">{`Font (${settings.fontSize})`}</span>
            <input
              type="range"
              step="2"
              min="14"
              max="140"
              value={settings.fontSize}
              onChange={(event) =>
                onSetFontSize(parseInt(event.currentTarget.value, 10))
              }
              data-testid="toolbar-font-size"
            />
          </div>

          <div className="topbar-slider-row">
            <span className="topbar-slider-text">{`Speed (${settings.speed})`}</span>
            <input
              type="range"
              step="1"
              min="1"
              max="100"
              value={settings.speed}
              onChange={(event) =>
                onSetSpeed(parseInt(event.currentTarget.value, 10))
              }
              data-testid="toolbar-speed"
            />
          </div>

          <div className="topbar-slider-row">
            <span className="topbar-slider-text">{`Margin (${marginPercent}%)`}</span>
            <input
              type="range"
              step="4"
              min="0"
              max={MAX_MARGIN}
              value={settings.margin}
              onChange={(event) =>
                onSetMargin(parseInt(event.currentTarget.value, 10))
              }
              data-testid="toolbar-margin"
            />
          </div>
        </div>

        <div className="topbar-actions" aria-label="Script actions">
          <button
            type="button"
            className="toolbar-action"
            onClick={onOpenFile}
            title="Open script file"
            aria-label="Open script file"
            data-testid="toolbar-open"
          >
            <span className="icon is-small">
              <i className="fa-solid fa-folder-open" />
            </span>
          </button>

          <button
            type="button"
            className="toolbar-action"
            onClick={onSaveFile}
            title="Save script file"
            aria-label="Save script file"
            data-testid="toolbar-save"
          >
            <span className="icon is-small">
              <i className="fa-solid fa-floppy-disk" />
            </span>
          </button>

          <button
            type="button"
            className="toolbar-action"
            onClick={onResetPosition}
            title="Return to the beginning"
            aria-label="Return to the beginning"
            data-testid="toolbar-reset"
          >
            <span className="icon is-small">
              <i className="fa-solid fa-arrows-rotate" />
            </span>
          </button>

          <button
            type="button"
            className="toolbar-action"
            onClick={onToggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            data-testid="toolbar-fullscreen"
          >
            <span className="icon is-small">
              <i
                className={`fa-solid ${isFullscreen ? "fa-compress" : "fa-expand"}`}
              />
            </span>
          </button>

          <button
            type="button"
            className={`toolbar-action ${isInstructionsOpen ? "is-active" : ""}`}
            onClick={onToggleInstructions}
            title={
              isInstructionsOpen ? "Hide instructions" : "Show instructions"
            }
            aria-label={
              isInstructionsOpen ? "Hide instructions" : "Show instructions"
            }
            data-testid="toolbar-instructions"
          >
            <span className="icon is-small">
              <i className="fa-solid fa-book" />
            </span>
          </button>

          <div className="topbar-align-menu" ref={alignmentMenuRef}>
            <button
              type="button"
              className={`toolbar-action topbar-align-toggle ${isAlignmentMenuOpen ? "is-active" : ""}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setIsAlignmentMenuOpen((previous) => !previous)}
              aria-expanded={isAlignmentMenuOpen}
              title="Text alignment"
              aria-label="Text alignment"
              data-testid="toolbar-align"
            >
              <span className="icon is-small">
                <i className="fa-solid fa-align-left" />
              </span>
            </button>

            <div className="topbar-align-popover" hidden={!isAlignmentMenuOpen}>
              {ALIGNMENT_OPTIONS.map((option) => (
                <button
                  key={option.command}
                  type="button"
                  className="toolbar-action"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyAlignment(option.command)}
                  title={option.label}
                  aria-label={option.label}
                  data-testid={`toolbar-${option.command}`}
                >
                  <span className="icon is-small">
                    <i className={`fa-solid ${option.icon}`} />
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className={`toolbar-action ${isMicActive ? "is-active" : ""}`}
            onClick={onToggleSpeech}
            title={
              isMicActive ? "Stop speech processing" : "Start speech processing"
            }
            aria-label={
              isMicActive ? "Stop speech processing" : "Start speech processing"
            }
            data-testid="toolbar-mic"
          >
            <span className="icon is-small">
              <i className="fa-solid fa-microphone" />
            </span>
          </button>

          <button
            type="button"
            className={`toolbar-action ${isPlaying ? "is-active" : ""}`}
            onClick={onTogglePlayback}
            title={isPlaying ? "Pause TelePrompter" : "Start TelePrompter"}
            aria-label={isPlaying ? "Pause TelePrompter" : "Start TelePrompter"}
            data-testid="toolbar-play"
          >
            <span className="icon is-small">
              <i className={`fa-solid ${isPlaying ? "fa-pause" : "fa-play"}`} />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
