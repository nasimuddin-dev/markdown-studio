# Markpion: Core Design

How Markpion is built: its layers, the security boundary, how documents are opened, edited, previewed and saved, and how the app is released and updated. The diagrams are [Mermaid](https://mermaid.js.org/); they render on GitHub and in Markpion's own preview.

Requirements are in [SRS.md](SRS.md) and their implementation status in [TRACEABILITY.md](TRACEABILITY.md). This document describes the code as of version 0.18.0; when the code and this document disagree, the code is right and this document needs fixing.

## 1. System context

Markpion is a local-first desktop app. Documents are ordinary Markdown files on the user's disk; nothing is uploaded. The only network request the app makes on its own is the update check, which asks GitHub for the latest release and can be turned off. The optional AI assistant sends text to Anthropic's Claude API only when the user runs an AI command, with their own key.

```mermaid
flowchart LR
  user([User])
  subgraph pc[User's computer]
    app[Markpion<br/>Tauri 2 desktop app]
    files[(Markdown files<br/>and images)]
    appdata[(App data<br/>settings, recents,<br/>recovery, history, logs)]
    os[OS shell<br/>dialogs, trash,<br/>file associations]
  end
  gh[(GitHub Releases<br/>latest.json + signed installers)]
  claude[(Anthropic Claude API<br/>api.anthropic.com)]

  user --> app
  app <-->|read / atomic write| files
  app <--> appdata
  app <--> os
  app -.->|update check, optional| gh
  app -.->|"AI commands, opt-in, user's key"| claude
```

## 2. Technology stack

| Layer | Technology |
| --- | --- |
| Desktop shell | Tauri 2 (Rust), system web view (WebView2 on Windows, WebKit on macOS and Linux) |
| UI | React 19 + TypeScript, built with Vite |
| Editor | CodeMirror 6 (Markdown language, search, lint, autocompletion) |
| Preview | react-markdown on unified: remark-gfm, remark-math, rehype-raw, rehype-sanitize, rehype-katex (MathML), rehype-highlight, rehype-slug; Mermaid for diagrams |
| State | Zustand stores |
| Export | HTML (unified), PDF (pdfmake; display math drawn by MathJax as SVG), Word (docx) |
| Import | Word (mammoth), PDF (pdf.js), HTML (turndown), CSV/TSV |
| Tests | Vitest, Playwright with axe-core (WCAG 2.1 AA), Rust unit tests |

Heavy libraries (Mermaid, KaTeX, MathJax, pdfmake, docx, mammoth, pdf.js) are loaded on first use, so they don't slow down startup.

## 3. Layered architecture

The frontend is split into four layers, and code only calls downwards. Every native operation goes through a single `Backend` interface, which has two implementations: the Tauri backend calls Rust commands, and the in-memory backend runs the same UI in a plain browser for the web demo and the end-to-end tests.

```mermaid
flowchart TB
  subgraph FE[Frontend: src/]
    direction TB
    C["components/<br/>Editor, Preview, TabBar, FileExplorer,<br/>Outline, MenuBar, CommandPalette, dialogs"]
    F["features/<br/>commands, documents (save), lifecycle,<br/>autosave, exporting, importing, workspace,<br/>watch, formatting, tables, lint, updates…"]
    S["stores/<br/>documentsStore, workspaceStore,<br/>settingsStore, uiStore (Zustand)"]
    SV["services/<br/>markdown pipeline, convert/ (PDF, Word, HTML, CSV),<br/>search, paths, errors"]
    B{{"Backend interface<br/>services/backend.ts"}}
    TB["tauriBackend<br/>(invoke Rust commands)"]
    MB["memoryBackend<br/>(browser demo, e2e tests)"]
    C --> F
    C --> S
    F --> S
    F --> SV
    F --> B
    SV --> B
    B --> TB
    B --> MB
  end

  subgraph RS[Rust core: src-tauri/src/]
    direction TB
    CMD["commands/<br/>dialogs, files, workspace,<br/>app_data, platform, ai<br/>(the only entry point)"]
    SC["scope.rs<br/>path validation"]
    FS["fs_ops.rs<br/>list, read, atomic write, trash"]
    ST["storage.rs<br/>settings, recovery, logs"]
    HI["history.rs<br/>versions before overwrite"]
    SE["search.rs<br/>find in files"]
    WA["watcher.rs<br/>external changes"]
    UP["updater.rs<br/>signed updates"]
    OP["open_paths.rs<br/>files from the OS"]
    AI["ai.rs / ai_local.rs<br/>Claude API (key in OS store) or local Ollama"]
    MN["menu.rs<br/>macOS menu bar"]
    CMD --> SC
    SC --> FS
    CMD --> ST
    CMD --> HI
    CMD --> SE
    CMD --> WA
    CMD --> UP
    CMD --> OP
    CMD --> AI
    CMD --> MN
  end

  TB -->|"IPC (invoke)"| CMD
```

| Layer | Responsibility |
| --- | --- |
| `components/` | React views. They read stores and run commands; they don't do I/O. |
| `features/` | Use cases: open, save, export, import, auto save, recovery, commands and shortcuts. |
| `stores/` | Application state: open documents, workspace, settings, UI state. |
| `services/` | Pure logic and adapters: the Markdown pipeline, converters, the backend. |
| Rust `commands/` | One module per domain (`dialogs`, `files`, `workspace`, `app_data`, `platform`, `ai`), mirroring the frontend's backend interfaces. Validates every request, then calls the filesystem, storage, history and AI modules. |

## 4. Security boundary

The web view is treated as untrusted. It has no filesystem, dialog or shell permissions: the Tauri capability (`src-tauri/capabilities/default.json`) grants only basic window operations. A path becomes usable only after the user picks it in a native dialog, opens it from the OS, or re-approves it from the recent files list. Every command checks its path against that approved scope before any I/O.

```mermaid
flowchart LR
  subgraph WV[Web view: untrusted]
    UI[React UI]
  end
  subgraph Core[Rust core: trusted]
    CMD[App command]
    V1{"Syntax check<br/>absolute path, no '..'"}
    V2{"Resolve symlinks,<br/>inside an approved<br/>file or folder?"}
    IO[Filesystem I/O]
    ERR[Refused:<br/>outOfScope / invalidPath]
  end
  DLG[Native dialog,<br/>OS 'Open with',<br/>recent file re-approval]

  DLG -->|approves path| Scope[(Scope:<br/>approved files and folders)]
  UI -->|invoke with path| CMD --> V1
  V1 -->|ok| V2
  V1 -->|bad| ERR
  Scope -.-> V2
  V2 -->|yes| IO
  V2 -->|no| ERR
```

Other safeguards:

- **Preview:** raw HTML in documents is sanitized (rehype-sanitize) before rendering; math is rendered after sanitizing, so it can't be used to inject markup. The Content Security Policy allows scripts only from the app itself, no plugins or frames, and network requests (`connect-src`) only to the GitHub API; remote images in documents may still load.
- **Links:** external links open in the system browser, never inside the app window.
- **Custom CSS** (a setting) is parsed by the browser and rebuilt rule by rule with every selector under `.markdown-body`, so it can style documents but never the app, and a stray brace can't escape that scope. `@import` and unknown at-rules are dropped, and `</` is escaped where it's written into exported HTML.
- **Git** is read-only: the Rust core runs the user's `git` (`status`, and `show HEAD:./file` for a file already in scope) with optional locks and the fsmonitor hook turned off, a 10-second timeout and no console window. Markpion never commits, pulls or pushes.
- **Updates:** every installer is verified against the minisign public key built into the app before it runs.
- **AI assistant:** off by default. The Anthropic API key is kept in the OS credential store and read only by the Rust core, which makes the HTTPS request; the web view sends the instruction and text and gets the answer back, never the key. The document text is wrapped in `<document>` tags and the system prompt tells Claude to treat it as content, not instructions. Answers are shown for review and applied as one undoable edit.

## 5. Document model and lifecycle

Each open tab is a `Doc` in `documentsStore`: its path (`null` until first saved), the current `content`, the `savedContent` last loaded or saved, the line ending and BOM to write back, the file's modification time, any external change, and whether editing is locked (`readOnly`: the file is read-only on disk, or the user turned it on). A document is **dirty** when `content` differs from `savedContent`. A locked document takes changes only from outside the editor (reloads): CodeMirror's `readOnly` stops typing, a change filter stops commands, and the store ignores `setContent`.

```mermaid
stateDiagram-v2
  [*] --> Untitled: New File
  [*] --> Clean: Open file
  Untitled --> Dirty: edit
  Clean --> Dirty: edit
  Dirty --> Clean: undo to saved text
  Dirty --> Saving: Save / auto save
  Untitled --> Saving: Save As (choose path)
  Saving --> Clean: written
  Saving --> ChangedOnDisk: file changed since it was read (save refused)
  Clean --> Clean: changed outside Markpion, reloaded automatically
  Dirty --> ChangedOnDisk: changed outside Markpion
  ChangedOnDisk --> Clean: Reload (discard mine)
  ChangedOnDisk --> Dirty: Keep Mine (next save overwrites)
  Clean --> Deleted: deleted or moved outside
  Dirty --> Deleted: deleted or moved outside
  Deleted --> Saving: Save to Recreate / Save As
  Clean --> [*]: close tab
  Dirty --> [*]: close (Save / Don't Save prompt)
```

Open files' modification times are checked every 3 seconds. A clean document that changed on disk is reloaded silently; an edited one shows a banner with **Reload**, **Compare** (opens the disk version in a new tab) and **Keep Mine**. The workspace watcher (`watcher.rs`, debounced file events) keeps the file explorer current.

## 6. Saving safely

Saving never writes into the user's file directly. The previous version is kept in local history, the new text goes to a temporary file in the same folder, and the temporary file is renamed over the original in one step. A crash or power cut therefore leaves either the old file or the new one, never a half-written file.

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant F as features/documents.ts
  participant B as tauriBackend
  participant C as commands/files.rs
  participant S as scope.rs
  participant H as history.rs
  participant FS as fs_ops.rs

  U->>F: Save (Ctrl/Cmd+S)
  F->>F: before-save transforms (trailing spaces, final newline…)
  F->>B: writeTextFile(path, text, line ending, BOM, expectedMtime)
  B->>C: invoke write_text_file
  C->>S: check(path)
  S-->>C: approved, resolved path
  C->>H: snapshot current file (up to 30 versions, files ≤ 10 MB)
  C->>FS: write_text_atomic
  FS->>FS: compare mtime with expectedMtime
  alt changed on disk since it was read
    FS-->>F: Conflict
    F->>U: Overwrite / Reload / Save As
  else unchanged
    FS->>FS: write temp file, flush, rename over target (retries if Windows locks it briefly)
    FS-->>F: new mtime
    F->>F: savedContent = content (tab is clean)
  end
```

## 7. Crash recovery and auto save

```mermaid
flowchart TB
  E[Edit in any tab] --> T["Recovery timer (5 s)"]
  T --> SNAP{Any unsaved documents?}
  SNAP -->|yes| W[("Write recovery/session.json<br/>in app data")]
  SNAP -->|no, and a snapshot exists| CL[Delete the snapshot]
  E --> AS{Auto save setting}
  AS -->|after a delay| D[Save once typing pauses]
  AS -->|on focus change| FC[Save when switching tabs<br/>or leaving the window]
  AS -->|off| N[Nothing]
  D & FC --> G{"Has a path and<br/>no unresolved external change?"}
  G -->|yes| SAVE[Safe save, section 6]
  G -->|no| N

  START([Next start]) --> R{Snapshot found?}
  R -->|yes| ASK[Offer Restore / Discard]
  R -->|no| OK[Normal start]
```

A normal close with unsaved documents asks Save / Don't Save / Cancel first, so the recovery snapshot only matters after a crash, a forced shutdown or a power cut.

## 8. Preview pipeline

The same unified pipeline (`services/markdown.ts`) feeds the live preview and the HTML export, so they look the same. The preview updates after a short pause in typing (a setting), and pauses for documents over 1 MB until the user asks it to render. For long documents a last rehype step (preview only) groups the top-level blocks into chunks; a chunk is a sized placeholder until it scrolls near the viewport, so only the visible part of the page is built (`components/PreviewChunks.tsx`). Before that, a preview-only step marks each top-level block with the source line it starts on (`data-line`, `services/sourceLines.ts`); split-view scrolling syncs by interpolating between those lines rather than by scroll proportion, and a double-click in the preview uses them to find the source.

```mermaid
flowchart LR
  MD[Markdown text] --> FM[Split YAML<br/>front matter]
  FM --> P[remark-parse]
  P --> GFM[remark-gfm<br/>tables, tasks,<br/>footnotes, strikethrough]
  GFM --> M1[remark-math]
  M1 --> R2H[remark → rehype]
  R2H --> RAW[rehype-raw<br/>inline HTML]
  RAW --> SAN[rehype-sanitize<br/>allow-list]
  SAN --> AL[GitHub alerts]
  AL --> KX[rehype-katex<br/>MathML output]
  KX --> HL[rehype-highlight]
  HL --> SL[rehype-slug<br/>heading anchors]
  SL --> RE[React elements]
  RE --> CMP{Custom components}
  CMP -->|mermaid code block| MER[Mermaid diagram<br/>lazy-loaded]
  CMP -->|image| IMG[Local image<br/>through the backend]
  CMP -->|task checkbox| TK[Click toggles<br/>the task in the source]
```

## 9. Import and export

Converters work on the Markdown syntax tree (mdast), not on the rendered HTML, so each format gets native structures: real Word headings, lists and footnotes, and PDF bookmarks and links.

```mermaid
flowchart LR
  subgraph In[Import]
    DOCX[Word .docx] -->|mammoth → HTML| TD[turndown + GFM]
    HTML[Web page .html] --> TD
    PDF[PDF] -->|pdf.js text + layout heuristics| PM[Headings, lists,<br/>paragraphs]
    CSV[CSV / TSV] --> TBL[Markdown table]
  end
  TD & PM & TBL --> DOC[(Markdown document)]

  DOC --> AST[mdast syntax tree]
  subgraph Out[Export]
    AST -->|unified pipeline| XH[Standalone HTML<br/>images embedded]
    AST -->|pdfmake| XP[PDF<br/>selectable text, bookmarks]
    AST -->|docx| XW[Word .docx<br/>native equations, footnotes]
  end
  MERM[Mermaid diagrams] -.->|drawn as pictures| XP & XW
  MATH[LaTeX math] -.->|"display: pictures (Windows)<br/>inline: styled text"| XP
  MATH -.->|"native equations (OMML)"| XW
```

## 10. Where data is stored

| Data | Location | Written by |
| --- | --- | --- |
| Documents and images | Wherever the user keeps them | Safe save (section 6); pasted images go to `assets/` (or the one folder name set in Settings, validated natively as a single name) next to the document |
| Settings | App config folder, `settings.json` | `storage.rs` (written through a temporary file) |
| Recent files and folders | App config folder, `recent.json` | `commands/app_data.rs` |
| Crash recovery | App data folder, `recovery/session.json` | Recovery timer (section 7) |
| File history | App data folder, `history/` | `history.rs`, before each overwrite |
| Diagnostic log | App log folder, `markpion.log` (1 MB cap) | `storage.rs` Logger; exportable from Help |
| Anthropic API key (optional) | Windows Credential Manager, macOS Keychain; on Linux `ai-key` (mode 600) in the app config folder | `ai.rs` |

The app folders are named after the bundle identifier, `com.markpion.app` (for example `%APPDATA%\com.markpion.app` on Windows). On first start Markpion copies them from `com.markdownstudio.app`, the identifier used before the app was renamed.

## 11. Updates

```mermaid
sequenceDiagram
  autonumber
  participant A as Markpion (installed)
  participant G as GitHub Releases
  participant I as NSIS installer

  A->>G: GET releases/latest/download/latest.json
  G-->>A: version, installer URL, signature
  alt newer version
    A->>A: offer Update now / Skip / Later
    A->>G: download installer
    A->>A: verify minisign signature (key built into the app)
    alt signature valid
      A->>I: run with /UPDATE (passive)
      I->>I: replace the app in place, keep settings
      I->>A: restart the new version
    else invalid
      A->>A: refuse and keep the current version
    end
  end
```

In-place updates are Windows-only for now; on macOS and Linux the app offers the download page.

## 12. Build and release

```mermaid
flowchart LR
  DEV[Commit on main] --> CI[CI: typecheck, Vitest,<br/>Playwright + axe, cargo test]
  DEV --> VS["npm run version:set x.y.z"]
  VS --> RI["npm run release:installer --offline<br/>(Windows, local)"]
  RI --> STD[Standard installer<br/>signed for the updater]
  RI --> OFF[Offline installer<br/>bundles WebView2]
  RI --> LJ[latest.json + SHA256SUMS]
  RI --> RD[README and INSTALL links]
  STD & OFF & LJ --> GH["npm run release:github<br/>GitHub Release vX.Y.Z"]
  GH --> WF["release.yml:<br/>macOS .dmg (arm64, x64),<br/>Linux AppImage, .deb, .rpm"]
  DEV --> DOCS[documentation.yml:<br/>VitePress site from docs/site/<br/>→ GitHub Pages]
```

The updater's private signing key never enters the repository; it stays in `~/.tauri/` on the release machine.

## 13. Backend adapters and the road to a cloud version

The UI depends on one interface, `Backend` (`src/services/backend.ts`), split by domain. Each domain can be implemented and replaced on its own, and `capabilities` tells the UI what the current host can do, so features adapt instead of checking "am I the desktop app?".

```mermaid
flowchart LR
  UI[React UI<br/>features, stores, components]
  subgraph IF[Backend interface]
    direction TB
    D[DialogsApi]
    F[FilesApi]
    W[WorkspaceApi]
    S[StorageApi]
    P[PlatformApi]
    A[AiApi]
    C[capabilities]
  end
  UI --> IF
  IF --> T["tauriBackend<br/>desktop: Rust commands"]
  IF --> M["MemoryBackend<br/>browser demo, tests"]
  IF -.-> CL["cloudBackend (future)<br/>HTTPS API + accounts"]
  T --> R[(Local disk,<br/>OS credential store)]
  CL -.-> SV[(Server: documents,<br/>versions, AI proxy)]
```

| Domain | Desktop today | What a web/cloud version would provide |
| --- | --- | --- |
| `DialogsApi` | Native Open/Save pickers that approve paths | In-app pickers over the user's cloud folders |
| `FilesApi` | Scope-checked disk I/O; reads report read-only files; saves carry the last-seen modification time | REST calls; the same `expectedMtime` field carries a revision/ETag, so conflict detection works unchanged |
| `WorkspaceApi` | Folder listing, search (Rust, with include/exclude globs), file watcher, read-only Git (status, and a file's committed text for change bars and File History) | Server-side listing and search; change notifications over a WebSocket |
| `StorageApi` | Settings, recents, recovery and history in app-data folders | Per-account settings and server-side version history |
| `PlatformApi` | Window title, full screen, the close guard (Save / Don't Save when the window closes), reveal in folder, OS "Open with", signed self-update, the native menu bar on macOS (`setNativeMenu` returns false elsewhere; chosen items come back through `onMenuCommand`; the menus themselves, with their submenus, come from `features/menus.ts`, the same model as the in-app menu bar) | The page title, the browser's Fullscreen API and a "leave page?" warning; the rest is absent (`capabilities` switches those UI features off) |
| `AiApi` | The Rust core calls Anthropic with the user's key from the OS credential store, or a local Ollama server (`localUrl`; loopback addresses only; `aiLocalModels` lists its models) | A server endpoint calls Anthropic with an organisation key, applying quotas and policies |

Design rules that keep this path open:

- **Paths are opaque to the UI.** Features pass the strings the backend returns; path helpers only format them for display and resolve relative Markdown links.
- **No feature talks to the OS or network directly**; it goes through `Backend`, and asks `capabilities` before offering host-specific actions. Only `services/` imports Tauri; `services/index.ts` is the one place that picks the host. A host whose backend is heavy or asynchronous loads it in `loadBackend()`, which `main.tsx` awaits before the first render (the browser demo's `MemoryBackend` loads this way, so the desktop app never downloads it).
- **Stores hold state, features hold workflows, services hold pure logic** (Markdown pipeline, converters, parsers). Pure logic is shared by every backend and runs in tests without a host.
- **Heavy features load on demand** (converters, Mermaid, KaTeX, the AI module, and the History, Keyboard Shortcuts, AI review, Settings and About dialogs and the Links panel, which are fetched a few seconds after startup), so a web build keeps a small first download.
- **Per-feature state stays separate** (for example `aiStore`), so new features don't grow one global store.

## 14. Design principles

- **Local first.** Files stay plain Markdown on the user's disk, readable without Markpion. No account, no cloud.
- **Never lose work.** Atomic saves, conflict detection, file history, crash recovery, and trash instead of permanent deletion. A rendering error is contained to its area (error boundaries), so the rest of the window, including saving, keeps working.
- **Least privilege.** The web view can't touch the filesystem; the Rust core validates every path.
- **One pipeline.** Preview and HTML export share the Markdown pipeline; exports convert the syntax tree to each format's native structures.
- **Fast start.** Heavy features load on first use, and the start-up JavaScript has a budget checked in CI (`npm run check:startup`). The Markdown editor's HTML support is a light version (`services/markdownHtml.ts`) without the CSS and JavaScript parsers the full HTML language bundles.
- **Stay responsive.** Rust commands check the scope first, then do file I/O on the blocking thread pool; large binary data crosses to the UI as raw bytes; long documents are previewed section by section (`services/markdownSections.ts`), parsing only what comes into view and re-parsing only the sections an edit touches; and above 1 MB of text the per-keystroke extras (live preview, checks, change markers, live counts) step back so typing doesn't.
- **Testable without the desktop shell.** The `Backend` interface lets the whole UI run in a browser, which is how the end-to-end and accessibility tests run.
- **One design system.** The UI's colours, type sizes, spacing, corner radii, shadows and layers are tokens (`src/styles/app/tokens.css`, with a dark value for every theme colour); each UI area has its own stylesheet, and a test rejects literal values and repeated selectors. Menus, the macOS menu bar and the command palette share one menu model (`features/menus.ts`).
