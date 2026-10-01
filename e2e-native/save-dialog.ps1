# Answers the app's native Save dialog (used by e2e-native tests, Windows only):
# waits for a dialog window titled $Title, types $Path as the file name and
# presses Save. WebDriver can't reach native dialogs, so this goes through
# Win32: the dialog class (#32770), the file-name box and the Save button (id 1).
param(
  [Parameter(Mandatory = $true)][string]$Path,
  [string]$Title = "Export",
  [int]$TimeoutSeconds = 20
)
$ErrorActionPreference = "Stop"
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class Dlg {
  public delegate bool EnumProc(IntPtr hwnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr parent, EnumProc cb, IntPtr lParam);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern int GetDlgCtrlID(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr w, string l);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
  public static string Text(IntPtr h) { var s = new StringBuilder(512); GetWindowText(h, s, 512); return s.ToString(); }
  public static string Cls(IntPtr h) { var s = new StringBuilder(256); GetClassName(h, s, 256); return s.ToString(); }
  public static IntPtr FindDialog(string title) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, l) => { if (IsWindowVisible(h) && Cls(h) == "#32770" && Text(h) == title) { found = h; return false; } return true; }, IntPtr.Zero);
    return found;
  }
  // The file-name box: an Edit inside the ComboBoxEx (id 1148), or an Edit with id 1001 on older dialogs.
  public static IntPtr FileNameEdit(IntPtr dlg) {
    IntPtr byId = IntPtr.Zero, first = IntPtr.Zero;
    EnumChildWindows(dlg, (h, l) => {
      if (Cls(h) != "Edit") return true;
      var id = GetDlgCtrlID(h);
      if (id == 1001 || id == 1148) { byId = h; return false; }
      if (first == IntPtr.Zero) first = h;
      return true;
    }, IntPtr.Zero);
    return byId != IntPtr.Zero ? byId : first;
  }
  public static IntPtr Button(IntPtr dlg, int id) {
    IntPtr found = IntPtr.Zero;
    EnumChildWindows(dlg, (h, l) => { if (Cls(h) == "Button" && GetDlgCtrlID(h) == id) { found = h; return false; } return true; }, IntPtr.Zero);
    return found;
  }
}
"@
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$dialog = [IntPtr]::Zero
while ($dialog -eq [IntPtr]::Zero) {
  if ((Get-Date) -gt $deadline) { throw "No '$Title' dialog appeared." }
  Start-Sleep -Milliseconds 200
  $dialog = [Dlg]::FindDialog($Title)
}
Start-Sleep -Milliseconds 400
$edit = [Dlg]::FileNameEdit($dialog)
if ($edit -eq [IntPtr]::Zero) { throw "The dialog has no file-name box." }
$WM_SETTEXT = 0x000C
$BM_CLICK = 0x00F5
[void][Dlg]::SendMessage($edit, $WM_SETTEXT, [IntPtr]::Zero, $Path)
$save = [Dlg]::Button($dialog, 1)
if ($save -eq [IntPtr]::Zero) { throw "The dialog has no Save button." }
[void][Dlg]::SendMessage($save, $BM_CLICK, [IntPtr]::Zero, [IntPtr]::Zero)
Write-Output "saved"
