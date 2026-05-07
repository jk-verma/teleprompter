import { forwardRef } from "react";
import type { ContentHandle } from "../content/Content";
import { Content } from "../content/Content";
import type {
  TeleprompterStatus,
  WorkspaceSettings,
} from "../navbar/navbarSlice";

type TeleprompterPageProps = {
  status: TeleprompterStatus;
  settings: WorkspaceSettings;
  scriptHtml: string;
  resetSignal: number;
  syncSignal: number;
  onScriptHtmlChange: (value: string) => void;
};

export const TeleprompterPage = forwardRef<
  ContentHandle,
  TeleprompterPageProps
>(function TeleprompterPage(
  { status, settings, scriptHtml, resetSignal, syncSignal, onScriptHtmlChange },
  ref,
) {
  return (
    <main className="teleprompter-page">
      <section className="teleprompter-workspace">
        <Content
          ref={ref}
          status={status}
          scriptHtml={scriptHtml}
          settings={settings}
          resetSignal={resetSignal}
          syncSignal={syncSignal}
          onScriptHtmlChange={onScriptHtmlChange}
        />
      </section>
    </main>
  );
});
