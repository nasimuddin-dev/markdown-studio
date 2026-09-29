; Markpion — NSIS installer hooks (Tauri `bundle.windows.nsis.installerHooks`).
;
; Tauri's built-in file association sets the default handler for .md files.
; These hooks add the rest of the Windows shell integration users expect:
;   * "Open with" lists Markpion (OpenWithProgids + Applications key)
;   * an explicit "Open with Markpion" context-menu item
;     (on Windows 11 it is under "Show more options")
;   * registration under Settings > Apps > Default apps (RegisteredApplications)
;   * "markpion" from the Run dialog (App Paths)
;   * support/about links on the Installed apps / Programs and Features entry
;   * removal of a previous install under the old name, Markdown Studio
; SHCTX follows the chosen install mode: HKCU for "just me", HKLM for everyone.

!define MS_PROGID "Markpion.Document"
!define MS_EXE "$INSTDIR\${MAINBINARYNAME}.exe"
!define MS_CAPS "Software\Markpion\Capabilities"
!define MS_UNINST "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}"
!define MS_HOMEPAGE "https://github.com/nasimuddin-dev/markpion"

!macro MS_REGISTER_EXT EXT
  WriteRegStr SHCTX "Software\Classes\${EXT}\OpenWithProgids" "${MS_PROGID}" ""
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe\SupportedTypes" "${EXT}" ""
  WriteRegStr SHCTX "${MS_CAPS}\FileAssociations" "${EXT}" "${MS_PROGID}"
  WriteRegStr SHCTX "Software\Classes\SystemFileAssociations\${EXT}\shell\Markpion" "" "Open with Markpion"
  WriteRegStr SHCTX "Software\Classes\SystemFileAssociations\${EXT}\shell\Markpion" "Icon" '"${MS_EXE}",0'
  WriteRegStr SHCTX "Software\Classes\SystemFileAssociations\${EXT}\shell\Markpion\command" "" '"${MS_EXE}" "%1"'
!macroend

!macro MS_UNREGISTER_EXT EXT
  DeleteRegValue SHCTX "Software\Classes\${EXT}\OpenWithProgids" "${MS_PROGID}"
  DeleteRegKey SHCTX "Software\Classes\SystemFileAssociations\${EXT}\shell\Markpion"
!macroend

; Markpion was called Markdown Studio up to version 0.13. Its uninstaller is run
; silently before installing, so the old app doesn't stay installed next to the
; new one. It keeps the user's settings (Markpion copies them on first start).
!macro MS_REMOVE_LEGACY ROOT
  Push $R0
  Push $R1
  ReadRegStr $R0 ${ROOT} "Software\Microsoft\Windows\CurrentVersion\Uninstall\Markdown Studio" "InstallLocation"
  StrCpy $R1 $R0 1
  ${If} $R1 == '"'
    StrCpy $R0 $R0 "" 1
    StrCpy $R0 $R0 -1
  ${EndIf}
  ${If} $R0 != ""
  ${AndIf} ${FileExists} "$R0\uninstall.exe"
    ExecWait '"$R0\uninstall.exe" /S _?=$R0'
    Delete "$R0\uninstall.exe"
    RMDir "$R0"
  ${EndIf}
  Pop $R1
  Pop $R0
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro MS_REMOVE_LEGACY HKCU
  !insertmacro MS_REMOVE_LEGACY HKLM
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; Document type (ProgID) used by "Open with" and Default apps.
  WriteRegStr SHCTX "Software\Classes\${MS_PROGID}" "" "Markdown Document"
  WriteRegStr SHCTX "Software\Classes\${MS_PROGID}" "FriendlyTypeName" "Markdown Document"
  WriteRegStr SHCTX "Software\Classes\${MS_PROGID}\DefaultIcon" "" '"${MS_EXE}",0'
  WriteRegStr SHCTX "Software\Classes\${MS_PROGID}\shell\open" "FriendlyAppName" "Markpion"
  WriteRegStr SHCTX "Software\Classes\${MS_PROGID}\shell\open\command" "" '"${MS_EXE}" "%1"'

  ; The application itself, so it shows by name in "Open with".
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe" "FriendlyAppName" "Markpion"
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe\DefaultIcon" "" '"${MS_EXE}",0'
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe\shell\open\command" "" '"${MS_EXE}" "%1"'

  ; Settings > Apps > Default apps.
  WriteRegStr SHCTX "${MS_CAPS}" "ApplicationName" "Markpion"
  WriteRegStr SHCTX "${MS_CAPS}" "ApplicationDescription" "Fast, local-first Markdown editor with live preview."
  WriteRegStr SHCTX "${MS_CAPS}" "ApplicationIcon" '"${MS_EXE}",0'
  WriteRegStr SHCTX "Software\RegisteredApplications" "Markpion" "${MS_CAPS}"

  ; Run dialog / "start markpion".
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\App Paths\${MAINBINARYNAME}.exe" "" "${MS_EXE}"
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\App Paths\${MAINBINARYNAME}.exe" "Path" "$INSTDIR"

  !insertmacro MS_REGISTER_EXT ".md"
  !insertmacro MS_REGISTER_EXT ".markdown"

  ; Tauri labels the default "open" verb of its association "Open with
  ; Markpion", which duplicates our explicit item above. Restore the standard
  ; Windows label ("Open", the double-click action) for that verb.
  DeleteRegValue SHCTX "Software\Classes\Markdown Document\shell\open" ""

  ; Richer Installed apps / Programs and Features entry.
  WriteRegStr SHCTX "${MS_UNINST}" "URLInfoAbout" "${MS_HOMEPAGE}"
  WriteRegStr SHCTX "${MS_UNINST}" "HelpLink" "${MS_HOMEPAGE}/blob/main/docs/INSTALL.md"
  WriteRegStr SHCTX "${MS_UNINST}" "URLUpdateInfo" "${MS_HOMEPAGE}#download"
  WriteRegStr SHCTX "${MS_UNINST}" "Comments" "Local-first Markdown editor"

  ; Tell Explorer that file associations changed.
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro MS_UNREGISTER_EXT ".md"
  !insertmacro MS_UNREGISTER_EXT ".markdown"
  DeleteRegKey SHCTX "Software\Classes\${MS_PROGID}"
  DeleteRegKey SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe"
  DeleteRegValue SHCTX "Software\RegisteredApplications" "Markpion"
  DeleteRegKey SHCTX "Software\Markpion"
  DeleteRegKey SHCTX "Software\Microsoft\Windows\CurrentVersion\App Paths\${MAINBINARYNAME}.exe"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
