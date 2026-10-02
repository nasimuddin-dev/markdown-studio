import { Group, Panel, Separator, useDefaultLayout, type LayoutStorage } from "react-resizable-panels";
import { MenuBar } from "./components/MenuBar";
import { FileExplorer } from "./components/FileExplorer";
import { Outline } from "./components/Outline";
import { SearchPanel } from "./components/SearchPanel";
import { TagsPanel } from "./components/TagsPanel";
import { Icon } from "./components/Icon";
import { useUi } from "./stores/uiStore";
import { commands, formatShortcut } from "./features/commands";
import { TabBar } from "./components/TabBar";
import { Editor } from "./components/Editor";
import { Toolbar } from "./components/Toolbar";
import { Breadcrumbs } from "./components/Breadcrumbs";
import { lazy, Suspense } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";

// The preview pulls in the Markdown/math/highlighting pipeline; load it in
// parallel with first paint instead of blocking startup on it.
const Preview = lazy(() => import("./components/Preview").then((m) => ({ default: m.Preview })));
// Rarely used dialogs stay out of the startup bundle; they are fetched once the app is idle.
const loadHistory = () => import("./components/HistoryDialog");
const loadShortcuts = () => import("./components/ShortcutsDialog");
const loadAi = () => import("./components/AiPanel");
const loadSettings = () => import("./components/SettingsDialog");
const loadLinkCheck = () => import("./components/LinkCheckPanel");
const ImagePreviewDialog = lazy(() => import("./components/ImagePreviewDialog").then((m) => ({ default: m.ImagePreviewDialog })));
const CompareDialog = lazy(() => import("./components/CompareDialog").then((m) => ({ default: m.CompareDialog })));
const HistoryDialog = lazy(() => loadHistory().then((m) => ({ default: m.HistoryDialog })));
const ShortcutsDialog = lazy(() => loadShortcuts().then((m) => ({ default: m.ShortcutsDialog })));
const AiPanel = lazy(() => loadAi().then((m) => ({ default: m.AiPanel })));
const SlideShow = lazy(() => import("./components/SlideShow").then((m) => ({ default: m.SlideShow })));
const SettingsDialog = lazy(() => loadSettings().then((m) => ({ default: m.SettingsDialog })));
const AboutDialog = lazy(() => loadSettings().then((m) => ({ default: m.AboutDialog })));
const LinkCheckPanel = lazy(() => loadLinkCheck().then((m) => ({ default: m.LinkCheckPanel })));
const loadSourceControl = () => import("./components/SourceControlPanel");
const SourceControlPanel = lazy(() => loadSourceControl().then((m) => ({ default: m.SourceControlPanel })));
const FeedbackDialog = lazy(() => import("./components/FeedbackDialog").then((m) => ({ default: m.FeedbackDialog })));
setTimeout(() => void Promise.all([loadHistory(), loadShortcuts(), loadAi(), loadSettings(), loadLinkCheck(), loadSourceControl()]).catch(() => {}), 3000);

/** Mounts the lazily loaded dialogs only once they are first needed. */
function OnDemandDialogs() {
  const history = useUi((s) => s.historyDocId !== null);
  const shortcuts = useUi((s) => s.shortcutsOpen);
  const ai = useAi((s) => !!s.busy || !!s.review);
  const presenting = useUi((s) => s.presenting);
  const compare = useUi((s) => s.compare !== null);
  const imagePreview = useUi((s) => s.imagePreview !== null);
  const settings = useUi((s) => s.settingsOpen);
  const about = useUi((s) => s.aboutOpen);
  const feedback = useUi((s) => s.feedback !== null);
  return (
    <Suspense fallback={null}>
      {history && <HistoryDialog />}
      {shortcuts && <ShortcutsDialog />}
      {ai && <AiPanel />}
      {presenting && <SlideShow />}
      {compare && <CompareDialog />}
      {imagePreview && <ImagePreviewDialog />}
      {settings && <SettingsDialog />}
      {about && <AboutDialog />}
      {feedback && <FeedbackDialog />}
    </Suspense>
  );
}

function PreviewPane() {
  // A document that broke the preview is retried as soon as it changes.
  const content = useDocuments((s) => s.docs.find((d) => d.id === s.activeId)?.content);
  return (
    <ErrorBoundary area="preview" resetKey={content}>
      <Suspense fallback={<div className="preview preview-loading">Loading preview…</div>}>
        <Preview />
      </Suspense>
    </ErrorBoundary>
  );
}

function EditorPane() {
  const activeId = useDocuments((s) => s.activeId);
  const toolbar = useSettings((s) => s.settings.showToolbar);
  const breadcrumbs = useSettings((s) => s.settings.showBreadcrumbs);
  const focusMode = useUi((s) => s.focusMode);
  return (
    <ErrorBoundary area="editor" resetKey={activeId}>
      <div className="editor-column">
        {toolbar && !focusMode && activeId && <Toolbar />}
        {breadcrumbs && !focusMode && activeId && <Breadcrumbs />}
        <Editor />
      </div>
    </ErrorBoundary>
  );
}
import { StatusBar } from "./components/StatusBar";
import { ChangeBanner } from "./components/ChangeBanner";
import { DialogHost, Toasts } from "./components/Dialogs";
import { Welcome } from "./components/Welcome";
import { CommandPalette } from "./components/CommandPalette";
import { useAi } from "./stores/aiStore";
import { useSettings } from "./stores/settingsStore";
import { CustomDocumentCss } from "./components/CustomDocumentCss";
import { useDocuments } from "./stores/documentsStore";

/** Panel sizes are a per-machine convenience, so browser storage is enough. */
const layoutStorage: LayoutStorage = {
  getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage unavailable */
    }
  },
};

/** The Explorer above the Outline, with a draggable divider while the Outline is open. */
function ExplorerAndOutline() {
  const outlineOpen = useSettings((s) => s.settings.showOutline);
  const layout = useDefaultLayout({ id: "explorer-outline", storage: layoutStorage, panelIds: ["files", "outline"] });
  if (!outlineOpen) {
    return (
      <>
        <FileExplorer />
        <Outline />
      </>
    );
  }
  return (
    <Group id="explorer-outline" orientation="vertical" className="sidebar-split" defaultLayout={layout.defaultLayout} onLayoutChanged={layout.onLayoutChanged}>
      <Panel id="files" defaultSize="60" minSize={80} className="sidebar-pane">
        <FileExplorer />
      </Panel>
      <Separator className="resize-handle horizontal" aria-label="Resize file explorer and outline" />
      <Panel id="outline" defaultSize="40" minSize={60} className="sidebar-pane">
        <Outline />
      </Panel>
    </Group>
  );
}

function Sidebar() {
  const view = useUi((s) => s.sidebarView);
  const setView = useUi((s) => s.setSidebarView);
  return (
    <div className="sidebar">
      <div className="sidebar-tabs" role="tablist" aria-label="Sidebar">
        <button
          role="tab"
          aria-selected={view === "explorer"}
          className={`sidebar-tab${view === "explorer" ? " active" : ""}`}
          onClick={() => setView("explorer")}
          title={`Explorer (${formatShortcut(commands.toggleExplorer.shortcut)})`}
        >
          <Icon name="files" size={15} /> <span className="sidebar-tab-label">Explorer</span>
        </button>
        <button
          role="tab"
          aria-selected={view === "search"}
          className={`sidebar-tab${view === "search" ? " active" : ""}`}
          onClick={() => useUi.getState().focusSearch()}
          title={`Search (${formatShortcut(commands.findInFiles.shortcut)})`}
        >
          <Icon name="search" size={15} /> <span className="sidebar-tab-label">Search</span>
        </button>
        <button
          role="tab"
          aria-selected={view === "links"}
          className={`sidebar-tab${view === "links" ? " active" : ""}`}
          onClick={() => setView("links")}
          title="Check links in the folder"
        >
          <Icon name="link" size={15} /> <span className="sidebar-tab-label">Links</span>
        </button>
        <button
          role="tab"
          aria-selected={view === "tags"}
          className={`sidebar-tab${view === "tags" ? " active" : ""}`}
          onClick={() => setView("tags")}
          title="Tags used in the folder"
        >
          <Icon name="tag" size={15} /> <span className="sidebar-tab-label">Tags</span>
        </button>
        <button
          role="tab"
          aria-selected={view === "git"}
          className={`sidebar-tab${view === "git" ? " active" : ""}`}
          onClick={() => setView("git")}
          title="Source Control (Git)"
        >
          <Icon name="branch" size={15} /> <span className="sidebar-tab-label">Git</span>
        </button>
      </div>
      {view === "explorer" ? (
        <ExplorerAndOutline />
      ) : view === "search" ? (
        <SearchPanel />
      ) : view === "links" ? (
        <Suspense fallback={null}>
          <LinkCheckPanel />
        </Suspense>
      ) : view === "git" ? (
        <Suspense fallback={null}>
          <SourceControlPanel />
        </Suspense>
      ) : (
        <TagsPanel />
      )}
    </div>
  );
}

function EditorArea() {
  const focusMode = useUi((s) => s.focusMode);
  const settingsViewMode = useSettings((s) => s.settings.viewMode);
  // Focus mode writes without the preview (unless the preview is all you have open).
  const viewMode = focusMode && settingsViewMode === "split" ? "editor" : settingsViewMode;
  const layout = useDefaultLayout({ id: "editor-preview", storage: layoutStorage, panelIds: ["editor", "preview"] });

  if (viewMode === "editor") return <div className="pane"><EditorPane /></div>;
  if (viewMode === "preview") return <div className="pane"><PreviewPane /></div>;
  return (
    <Group id="editor-preview" orientation="horizontal" className="split" defaultLayout={layout.defaultLayout} onLayoutChanged={layout.onLayoutChanged}>
      <Panel id="editor" minSize="20" className="pane"><EditorPane /></Panel>
      <Separator className="resize-handle" aria-label="Resize editor and preview" />
      <Panel id="preview" minSize="20" className="pane"><PreviewPane /></Panel>
    </Group>
  );
}

export default function App() {
  const focusMode = useUi((s) => s.focusMode);
  const showExplorer = useSettings((s) => s.settings.showExplorer) && !focusMode;
  const hasDocs = useDocuments((s) => s.docs.length > 0);
  const panelIds = showExplorer ? ["explorer", "main"] : ["main"];
  const layout = useDefaultLayout({ id: "workbench", storage: layoutStorage, panelIds });

  return (
    <div className={`app${focusMode ? " focus-mode" : ""}`}>
      <MenuBar />
      <Group
        id="workbench"
        key={panelIds.join()}
        orientation="horizontal"
        className="workbench"
        defaultLayout={layout.defaultLayout}
        onLayoutChanged={layout.onLayoutChanged}
      >
        {showExplorer && (
          <>
            <Panel id="explorer" defaultSize="20" minSize={170} maxSize="45">
              <ErrorBoundary area="sidebar">
                <Sidebar />
              </ErrorBoundary>
            </Panel>
            <Separator className="resize-handle" aria-label="Resize file explorer" />
          </>
        )}
        <Panel id="main" minSize="30">
          <main className="main-area">
            {hasDocs ? (
              <>
                {!focusMode && (
                  <ErrorBoundary area="tab bar">
                    <TabBar />
                  </ErrorBoundary>
                )}
                <ChangeBanner />
                <div className="editor-area">
                  <EditorArea />
                </div>
              </>
            ) : (
              <Welcome />
            )}
          </main>
        </Panel>
      </Group>
      {!focusMode && (
        <ErrorBoundary area="status bar">
          <StatusBar />
        </ErrorBoundary>
      )}
      <CommandPalette />
      <OnDemandDialogs />
      <DialogHost />
      <Toasts />
      <CustomDocumentCss />
    </div>
  );
}
