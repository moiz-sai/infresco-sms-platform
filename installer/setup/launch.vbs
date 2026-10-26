' Desktop icon: opens Infresco SMS in its own window (Edge app mode), or the default browser.
' If the system is not answering yet (PC just started), waits up to a minute before saying so.
Option Explicit
Dim shell, fso, url, http, i, ok
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

url = "http://localhost:8080"
Dim urlFile : urlFile = shell.ExpandEnvironmentStrings("%ProgramData%") & "\InfrescoSMS\app-url.txt"
If fso.FileExists(urlFile) Then url = Trim(fso.OpenTextFile(urlFile).ReadAll())

ok = False
For i = 1 To 30
  On Error Resume Next
  Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  http.setTimeouts 2000, 2000, 2000, 2000
  http.Open "GET", url & "/api/health", False
  http.Send
  If Err.Number = 0 Then
    If http.Status = 200 Then ok = True
  End If
  Err.Clear
  On Error GoTo 0
  If ok Then Exit For
  WScript.Sleep 2000
Next

If Not ok Then
  MsgBox "Infresco SMS is not answering yet." & vbCrLf & vbCrLf & _
    "If the computer has just started, wait one minute and try again." & vbCrLf & _
    "If it still does not open, restart the computer or call support.", vbExclamation, "Infresco SMS"
  WScript.Quit 1
End If

On Error Resume Next
shell.Run "msedge --app=" & url & " --window-size=1280,860", 1, False
If Err.Number <> 0 Then
  Err.Clear
  shell.Run url, 1, False
End If
