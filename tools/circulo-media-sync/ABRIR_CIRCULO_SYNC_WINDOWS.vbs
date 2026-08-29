Option Explicit

Dim shell, fso, baseFolder, startScript, appUrl, http, isRunning

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

baseFolder = fso.GetParentFolderName(WScript.ScriptFullName)
startScript = fso.BuildPath(baseFolder, "INICIAR_CIRCULO_SYNC_WINDOWS.cmd")
appUrl = "http://127.0.0.1:4317"
isRunning = False

On Error Resume Next
Set http = CreateObject("MSXML2.XMLHTTP")
http.Open "GET", appUrl & "/api/state", False
http.Send

If Err.Number = 0 Then
  If http.Status >= 200 And http.Status < 400 Then
    isRunning = True
  End If
End If

Err.Clear
On Error GoTo 0

If isRunning Then
  shell.Run appUrl, 1, False
Else
  shell.Run Chr(34) & startScript & Chr(34), 0, False
End If
