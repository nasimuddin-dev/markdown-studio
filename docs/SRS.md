# Markpion — Software Requirements Specification

*Cross-Platform Desktop Markdown Editor*

> Converted from `Markdown_Studio_SRS_v1.0.docx`. This Markdown file is now the source of truth for the SRS.

| Document Information | Value |
|---|---|
| Document Type | Software Requirements Specification (SRS) |
| Product | Markpion |
| Version | 1.1 |
| Status | Baseline, with implementation status |
| Target Platforms | Windows, macOS, Linux |
| Desktop Framework | Tauri |
| Frontend | React + TypeScript |
| Initial Release | MVP / v0.1 |
| Current Product Version | 0.18.0 |

### Revision History

| Version | Date | Changes |
|---|---|---|
| 1.0 | — | Baseline, converted from `Markdown_Studio_SRS_v1.0.docx`. |
| 1.1 | 2026-09-25 | Added the revision history and implementation-status notes (§13, §18, §21). Requirement text is unchanged. |
| 1.2 | 2026-09-29 | The product was renamed from Markdown Studio to Markpion; the name is updated throughout. Requirements are otherwise unchanged. |

> **Implementation status.** Requirement-by-requirement status is tracked in [TRACEABILITY.md](TRACEABILITY.md). As of 0.18.0, every MVP functional requirement (FR-001 to FR-063) is implemented, as are the auto-update requirements. Many §19 future enhancements have been delivered early: outline, linting, Mermaid and math, export to HTML, PDF and Word, version history, and read-only Git integration (status, change bars, the last commit in File History). The notes marked *Status* below record decisions made during development.

## Table of Contents

- [1. Introduction](#1-introduction)
- [2. Product Overview](#2-product-overview)
- [3. Goals and Objectives](#3-goals-and-objectives)
- [4. Scope](#4-scope)
- [5. Stakeholders and User Types](#5-stakeholders-and-user-types)
- [6. Functional Requirements](#6-functional-requirements)
- [7. Non-Functional Requirements](#7-non-functional-requirements)
- [8. User Interface Requirements](#8-user-interface-requirements)
- [9. Technical Architecture](#9-technical-architecture)
- [10. Data and File Handling](#10-data-and-file-handling)
- [11. Security Requirements](#11-security-requirements)
- [12. Error Handling and Recovery](#12-error-handling-and-recovery)
- [13. Packaging, Installation, and Distribution](#13-packaging-installation-and-distribution)
- [14. Auto-Update Requirements](#14-auto-update-requirements)
- [15. Accessibility and Usability](#15-accessibility-and-usability)
- [16. Logging and Diagnostics](#16-logging-and-diagnostics)
- [17. Testing and Acceptance Criteria](#17-testing-and-acceptance-criteria)
- [18. Release Strategy](#18-release-strategy)
- [19. Future Enhancements](#19-future-enhancements)
- [20. Risks and Mitigations](#20-risks-and-mitigations)
- [21. Open Questions](#21-open-questions)
- [Appendix A — Suggested MVP User Flows](#appendix-a--suggested-mvp-user-flows)
- [Appendix B — Recommended Initial Repository Structure](#appendix-b--recommended-initial-repository-structure)
- [Appendix C — Recommended MVP Technology Stack](#appendix-c--recommended-mvp-technology-stack)

## 1. Introduction

### 1.1 Purpose

This SRS defines the functional, non-functional, technical, security, distribution, and quality requirements for Markpion, a standalone cross-platform desktop application for creating, opening, editing, previewing, organizing, and saving Markdown documents.

### 1.2 Product Vision

Markpion will provide a fast, professional, privacy-conscious Markdown editing experience for Windows, macOS, and Linux. Core editing will work locally without requiring an internet connection.

### 1.3 Definitions

| Term | Definition |
|---|---|
| Markdown | Lightweight plain-text markup language. |
| MVP | Minimum Viable Product for the first usable release. |
| Workspace | A folder selected by the user as the working project/document directory. |
| Preview | Rendered representation of Markdown content. |
| Dirty State | Document changed since its last successful save. |
| Installer | Platform-specific package used to install the application. |

## 2. Product Overview

Markpion is a local-first desktop application packaged with Tauri. Users will not need Node.js, Python, or a separate server runtime to use the released application.

- Native desktop experience on Windows, macOS, and Linux.
- Local Markdown editing and file management.
- Split-pane editor and live preview.
- Folder/workspace navigation and file explorer.
- Multiple tabs and document state management.
- Native file/folder dialogs.
- Foundation for optional future AI features.

## 3. Goals and Objectives

- Provide simple installation and first launch on supported operating systems.
- Allow users to create, open, edit, preview, and save Markdown documents.
- Support common Markdown/GitHub Flavored Markdown features.
- Minimize accidental data loss through unsaved-change detection and safe save behavior.
- Provide responsive editing for normal documentation files.
- Use one maintainable codebase across supported desktop platforms.
- Provide a foundation for future publishing, plugins, and AI-assisted workflows.

## 4. Scope

### 4.1 MVP In Scope

- Create, open, edit, save, and Save As Markdown files.
- Open a folder/workspace and display a file explorer.
- Open multiple documents in tabs.
- Live Markdown preview.
- Markdown syntax highlighting.
- Basic Find and Replace.
- Rename and delete files with appropriate confirmation.
- Dirty-state indicator and unsaved-change prompts.
- Dark/light theme.
- Keyboard shortcuts for common actions.
- Native open/save/folder dialogs.
- Windows, macOS, and Linux packaging.

### 4.2 Out of Scope for MVP

- Real-time multi-user collaboration.
- Cloud document synchronization.
- Built-in Git client.
- Full IDE/debugger capabilities.
- Mandatory cloud AI service.
- Mobile/tablet versions.
- Enterprise identity management.

## 5. Stakeholders and User Types

| User Type | Needs |
|---|---|
| General Markdown User | Quickly create and edit Markdown files. |
| Developer | Edit README files, documentation, technical notes, and code snippets. |
| Technical Writer | Create structured documentation with preview and file navigation. |
| Power User | Use keyboard shortcuts, tabs, search, themes, and workspaces. |
| Product Owner | Review requirements and approve scope and releases. |
| Development Team | Implement, test, package, and maintain the application. |

## 6. Functional Requirements

### 6.1 Application Startup

- **FR-001:** The application shall launch as a native desktop application.
- **FR-002:** The application shall display the main workspace within 5 seconds on a typical supported machine under normal conditions.
- **FR-003:** The application shall restore eligible UI state such as theme and window size.
- **FR-004:** If the previous session contained unsaved documents, the application shall use a safe recovery mechanism where feasible.

### 6.2 File and Workspace Management

- **FR-010:** The user shall be able to open an individual Markdown file through a native file picker.
- **FR-011:** The user shall be able to open a folder as a workspace.
- **FR-012:** The file explorer shall display folders and supported Markdown files.
- **FR-013:** The user shall be able to create a new Markdown document.
- **FR-014:** The user shall be able to save a document to a selected path.
- **FR-015:** The user shall be able to use Save As to create a copy at another path.
- **FR-016:** The user shall be able to rename a file from the file explorer.
- **FR-017:** The user shall be able to delete a file with appropriate confirmation.
- **FR-018:** The application shall detect external file changes and notify the user before overwriting newer external content.

### 6.3 Editor

- **FR-020:** The editor shall provide Markdown-aware syntax highlighting.
- **FR-021:** The editor shall support undo and redo.
- **FR-022:** The editor shall support copy, cut, paste, select all, and keyboard navigation.
- **FR-023:** The editor shall support line and column positioning.
- **FR-024:** The editor shall provide a dirty-state indicator after modifications.
- **FR-025:** The editor shall support configurable font size and editor appearance.
- **FR-026:** The application shall preserve Unicode text correctly, including UTF-8 documents.

### 6.4 Preview

- **FR-030:** The application shall render Markdown in a preview pane.
- **FR-031:** Preview shall update after document changes with a configurable debounce interval.
- **FR-032:** The renderer shall support GitHub Flavored Markdown features including tables, task lists, and fenced code blocks.
- **FR-033:** Code blocks shall support syntax highlighting where a supported language is identified.
- **FR-034:** The preview shall safely sanitize or constrain potentially unsafe HTML/content according to the security design.
- **FR-035:** The user shall be able to switch between editor-only, preview-only, and split-view modes.

### 6.5 Tabs and Navigation

- **FR-040:** The user shall be able to open multiple documents in tabs.
- **FR-041:** The active tab shall be visually identifiable.
- **FR-042:** Closing a dirty tab shall prompt the user to save, discard, or cancel.
- **FR-043:** The application shall provide next/previous tab navigation.
- **FR-044:** The application shall provide a recent-files or recent-workspaces mechanism in a future-compatible design.

### 6.6 Search and Replace

- **FR-050:** The user shall be able to search within the current document.
- **FR-051:** The user shall be able to replace occurrences within the current document.
- **FR-052:** Search shall support case-sensitive and case-insensitive modes.
- **FR-053:** The application should support regular-expression search in a later release.

### 6.7 Settings

- **FR-060:** The user shall be able to switch between light and dark themes.
- **FR-061:** The user shall be able to configure editor font size.
- **FR-062:** Settings shall persist between application launches.
- **FR-063:** Settings shall be stored using the platform-appropriate application-data location.

## 7. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-001 | Performance | Typing and cursor movement should feel immediate; target UI response under 100 ms for ordinary editing operations. |
| NFR-002 | Performance | Preview rendering should normally complete within 500 ms for typical documents. |
| NFR-003 | Startup | Target cold startup under 5 seconds on a typical supported desktop. |
| NFR-004 | Reliability | A normal save operation shall report success/failure clearly and shall not silently discard content. |
| NFR-005 | Availability | Core editing features shall work offline. |
| NFR-006 | Portability | The same product shall be distributable on Windows, macOS, and Linux. |
| NFR-007 | Security | Filesystem access shall be limited to approved application operations and user-selected locations. |
| NFR-008 | Privacy | Core document content shall remain local unless the user explicitly enables a future cloud/AI feature. |
| NFR-009 | Maintainability | The codebase shall use modular components and automated tests. |
| NFR-010 | Accessibility | Keyboard navigation and visible focus states shall be supported for core functions. |
| NFR-011 | Compatibility | The release shall document minimum supported OS versions and CPU architectures. |

## 8. User Interface Requirements

The primary UI should follow a professional desktop-editor layout:

- Application menu/toolbar at the top.
- File explorer/navigation panel on the left.
- Editor area in the center.
- Markdown preview on the right when split view is enabled.
- Document tabs above the editor.
- Status bar showing encoding, language, line/column, and save state.
- Settings/preferences screen.
- Native dialogs for opening and saving files.

### 8.1 Main Screen

Conceptual layout: File Explorer | Tabs + Editor | Preview. The layout shall be resizable, and panels should remember their last user-selected dimensions where practical.

## 9. Technical Architecture

Recommended architecture:

| Layer | Technology / Responsibility |
|---|---|
| Desktop Shell | Tauri 2; native window, lifecycle, permissions, packaging. |
| UI | React + TypeScript; components, layouts, settings. |
| Editor | CodeMirror 6 or equivalent modern editor component. |
| Markdown | remark/Unified ecosystem and GitHub Flavored Markdown support. |
| Rendering | react-markdown or equivalent controlled renderer; sanitization required. |
| State | Zustand or equivalent lightweight state management. |
| Native APIs | Tauri filesystem, dialog, path, window, and updater capabilities. |
| Build | Vite + Tauri build pipeline. |
| Distribution | GitHub Releases or equivalent artifact hosting plus platform signing/notarization. |

### 9.1 Architectural Principles

- Local-first for core editing.
- Least-privilege filesystem permissions.
- Clear separation between UI state and native filesystem operations.
- No requirement for a backend server in MVP.
- Provider-agnostic design for future AI integration.
- Testable services for file operations and Markdown rendering.

## 10. Data and File Handling

### 10.1 Supported Files

- Primary extensions: .md and .markdown.
- Encoding: UTF-8.
- Line endings: LF and CRLF should be read correctly; save behavior should be configurable or consistent by documented policy.
- Optional future support: .mdx and front-matter-aware documents.

### 10.2 Save Strategy

- The application shall write the current editor content to the selected file.
- Save failures shall not clear the editor's dirty state.
- The application should use an atomic or temporary-file strategy where practical to reduce corruption risk.
- The application shall detect permission failures and present an actionable message.
- Before overwriting a file changed externally, the application should notify the user and provide a safe choice.

## 11. Security Requirements

- **SEC-001:** The application shall use Tauri's permission/capability model and grant only required native permissions.
- **SEC-002:** User-supplied paths shall be validated before filesystem operations.
- **SEC-003:** Path traversal such as ../ shall not permit unintended access outside an approved operation scope.
- **SEC-004:** Preview rendering shall not execute arbitrary untrusted scripts.
- **SEC-005:** External links shall open through controlled OS/browser mechanisms rather than arbitrary embedded execution.
- **SEC-006:** Any future AI integration shall clearly identify when document content leaves the local machine.
- **SEC-007:** Secrets/API keys shall not be hard-coded into the client application.
- **SEC-008:** Release artifacts should be digitally signed where supported by the target platform.

## 12. Error Handling and Recovery

| Scenario | Expected Behavior |
|---|---|
| File not found | Show a clear error and offer to locate/reopen the file. |
| Permission denied | Explain that the file cannot be written and provide Save As as an alternative. |
| Invalid/unsupported encoding | Report the issue without silently corrupting content. |
| External file modification | Notify user and provide reload/compare/keep-current options as supported. |
| Application crash | Attempt to recover unsaved content through a recovery mechanism where feasible. |
| Insufficient disk space | Report failure and keep the editor content available for another save attempt. |
| Corrupt configuration | Use safe defaults and preserve recoverable user data. |

## 13. Packaging, Installation, and Distribution

### 13.1 Windows

- Provide signed .msi and/or .exe installer.
- Support x64 initially; add ARM64 if required by the product roadmap.
- Create Start Menu and optional desktop shortcuts.
- Support clean uninstall through standard Windows mechanisms.

### 13.2 macOS

- Provide signed .dmg and/or application bundle.
- Support Intel and Apple Silicon according to the release target.
- Use Apple notarization for public distribution.
- Support standard Applications installation.

### 13.3 Linux

- Provide AppImage for broad compatibility in the initial release.
- Provide .deb and optionally .rpm for package-manager-oriented distributions.
- Document minimum tested distributions.

> *Status (0.13.0):* every GitHub Release carries a separate installer for each OS: Windows NSIS standard and offline (WebView2 included), macOS `.dmg` for Apple Silicon and Intel, and Linux `.AppImage`, `.deb` and `.rpm` (x86_64). Minimum versions are documented in [INSTALL.md](INSTALL.md). Code signing (Authenticode, Apple notarization) is still pending certificates, and Windows/Linux ARM64 are not built yet.

### 13.4 Distribution Website

The product website shall provide OS-specific download options. The site may detect the user's operating system and recommend the appropriate installer. Release binaries may be hosted through GitHub Releases, cloud object storage, or another controlled distribution service.

## 14. Auto-Update Requirements

- **UPD-001:** The application should support optional automatic update checks.
- **UPD-002:** The user shall be able to see the current version and available version.
- **UPD-003:** Updates shall be cryptographically verified before installation.
- **UPD-004:** The user shall be able to postpone an update.
- **UPD-005:** Failed updates shall not leave the application in an unusable state.
- **UPD-006:** Update behavior shall respect platform-specific signing and security requirements.

## 15. Accessibility and Usability

- Core functions shall be accessible by keyboard.
- Menus and buttons shall have clear labels/tooltips.
- Focus states shall be visible.
- Text and controls shall remain usable at increased UI scaling.
- Color shall not be the only indicator of document state.
- Error messages shall explain what happened and what the user can do next.
- The product shall follow practical WCAG-informed accessibility principles for its web-based UI components.

## 16. Logging and Diagnostics

- Application logs shall avoid storing document contents by default.
- Logs shall contain useful diagnostic information such as application version, operation type, and error category.
- Sensitive paths or secrets should be redacted where practical.
- The user should have a way to export diagnostic logs for support.
- Logging verbosity should be configurable for development/debug builds.

## 17. Testing and Acceptance Criteria

### 17.1 Test Levels

- Unit tests for file/path services, Markdown transformations, and state logic.
- Component tests for editor/preview interactions.
- Integration tests for Tauri filesystem operations.
- End-to-end tests for critical workflows.
- Manual acceptance testing on each supported operating system.

### 17.2 MVP Acceptance Criteria

- User can install the application on Windows, macOS, and Linux using documented installers/packages.
- User can create a Markdown file, enter content, preview it, save it, close it, and reopen it.
- User can open a folder and navigate Markdown files.
- Unsaved changes are clearly indicated and protected when closing a document.
- Markdown tables, lists, task lists, headings, links, images, and fenced code blocks render correctly.
- Application works for core editing without internet connectivity.
- Invalid paths and permission errors do not crash the application.
- Release artifacts are versioned and reproducibly built.
- Critical security tests for path traversal and unsafe preview content pass.

## 18. Release Strategy

| Release | Scope |
|---|---|
| v0.1 / MVP | Core editor, file operations, preview, tabs, themes, packaging. |
| v0.2 | Improved search/replace, recovery, external-change detection, recent files. |
| v0.3 | Mermaid, math, enhanced Markdown features, improved customization. |
| v1.0 | Stable cross-platform release, signing/notarization, updater, polished UX, documented support matrix. |
| Future | AI assistant, plugins, Git integration, cloud sync, collaboration, publishing workflows. |

> *Status (0.13.0):* the v0.1, v0.2 and v0.3 scopes are delivered, and the updater from v1.0 is too (signed in-place updates on Windows; macOS and Linux are offered the download page). The remaining v1.0 items are installer signing and notarization, and cross-platform verification on real macOS and Linux hardware. The project's version numbers (0.4 to 0.13) count feature releases and don't map one-to-one to this table.

## 19. Future Enhancements

- AI writing and editing assistant.
- Local LLM integration through configurable providers.
- Cloud AI providers with explicit user consent.
- Git integration and source-control status.
- Markdown linting.
- Document outline and navigation.
- Mermaid diagrams and LaTeX math.
- Export to HTML and PDF.
- Plugin/extension architecture.
- Cloud synchronization.
- Real-time collaboration.
- Version history and document snapshots.
- Publishing to static sites or documentation platforms.

## 20. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Cross-platform filesystem differences | Use Tauri APIs and automated OS-specific tests. |
| macOS security warnings | Use Apple Developer signing and notarization for public releases. |
| Windows security/reputation warnings | Sign installers and establish a consistent release identity. |
| Data loss during save | Use safe-save/atomic strategies, dirty state, recovery, and backups where appropriate. |
| Unsafe Markdown/HTML rendering | Sanitize output and restrict script execution. |
| Large document performance | Benchmark large files and use editor virtualization/incremental rendering. |
| Update failure | Verify packages, provide rollback/recovery strategy, and test update paths. |
| Feature creep | Maintain MVP scope and prioritize future features in separate releases. |

## 21. Open Questions

| Question | Status |
|---|---|
| Which minimum Windows, macOS, and Linux versions will be officially supported? | **Answered in practice:** Windows 10 1803+ and 11; macOS 10.15+; Linux x86_64 distributions from 2022 (Ubuntu 22.04+, Debian 12+, Fedora 36+). See [INSTALL.md](INSTALL.md). |
| Will the first release support x64 only or x64 + ARM64? | **Partly answered:** Windows and Linux x64; macOS both Intel and Apple Silicon. Windows/Linux ARM64 are open. |
| Should the product use a permissive open-source license, a proprietary license, or a dual-license model? | Open: needs a decision by the product owner. |
| Will AI functionality be part of v1.0 or a later release? | Open. |
| Should AI features support local models, cloud providers, or both? | Open. |
| Should Markdown HTML be fully supported, partially supported, or sanitized to a strict subset? | **Answered:** raw HTML is parsed, then sanitized to GitHub's allow-list (FR-034, SEC-004). |
| Should the application include Git integration in the first major release? | Open. |
| What product name, domain, logo, and application identifier will be used for signing and releases? | **Partly answered:** "Markpion", identifier `com.markpion.app`, releases on GitHub. Domain and signing identity are open. |
| Will telemetry be collected? If yes, what is collected and what consent mechanism is required? | **Answered:** no telemetry. The app's only own network request is the optional update check to GitHub, which can be turned off in Settings (web images referenced in a document load when previewed). |

## Appendix A — Suggested MVP User Flows

### A.1 Install and First Launch

1. Download the installer for your operating system from the official website (today: the README download section or GitHub Releases).
2. Run the platform installer/package.
3. Launch Markpion.
4. Select Open Folder or Create New Document.
5. Begin editing locally.

### A.2 Edit and Save

1. Open a Markdown file.
2. Edit content in the editor.
3. Review live preview.
4. Press Ctrl/Cmd+S.
5. Application writes the file and clears the dirty state.
6. Continue editing or close the tab.

### A.3 Close with Unsaved Changes

1. User edits a document.
2. User closes the tab/application.
3. Application detects dirty state.
4. Prompt: Save / Don't Save / Cancel.
5. Perform the selected action safely.

## Appendix B — Recommended Initial Repository Structure

```text
markpion/
├── src/
│   ├── components/
│   ├── features/
│   ├── services/
│   ├── stores/
│   ├── types/
│   └── App.tsx
├── src-tauri/
│   ├── src/
│   ├── capabilities/
│   └── tauri.conf.json
├── tests/
├── public/
├── package.json
├── vite.config.ts
└── README.md
```

## Appendix C — Recommended MVP Technology Stack

| Area | Recommendation |
|---|---|
| Desktop | Tauri 2 |
| Frontend | React + TypeScript |
| Build | Vite |
| Editor | CodeMirror 6 |
| Markdown | remark + remark-gfm |
| Preview | react-markdown + sanitization |
| State | Zustand |
| Testing | Vitest + React Testing Library + Playwright where practical |
| CI/CD | GitHub Actions |
| Release | GitHub Releases or equivalent |
| Signing | Windows code signing + Apple Developer signing/notarization; Linux package signing as applicable |
