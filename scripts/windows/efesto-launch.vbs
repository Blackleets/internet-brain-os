' Efesto: abre Efesto sin ventanas de consola (acceso directo "Efesto" del escritorio / menu Inicio).
' Uso: wscript.exe efesto-launch.vbs [open|stop] [/quiet]   (/quiet: sin avisos, p. ej. al desinstalar)
' Arranca Ollama, el Kernel (127.0.0.1:4310), el panel (127.0.0.1:3311, compilacion de produccion) y el
' trabajador de Hermes ocultos, y abre el panel en el navegador predeterminado. Sin extension ni emparejamiento.
Option Explicit
Dim shell, fso, action, quiet, here, repo, base, nodeExe, nodeFile, stream, logs, cmd, code
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
action = "open"
If WScript.Arguments.Count > 0 Then action = LCase(WScript.Arguments(0))
If action <> "open" And action <> "stop" Then action = "open"
quiet = False
If WScript.Arguments.Count > 1 Then quiet = (LCase(WScript.Arguments(1)) = "/quiet")
here = fso.GetParentFolderName(WScript.ScriptFullName)
repo = fso.GetParentFolderName(fso.GetParentFolderName(here))
base = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Efesto"
logs = base & "\logs"
If Not fso.FolderExists(base) Then fso.CreateFolder(base)
If Not fso.FolderExists(logs) Then fso.CreateFolder(logs)
nodeExe = "node"
nodeFile = base & "\node-path.txt"
If fso.FileExists(nodeFile) Then
  Set stream = fso.OpenTextFile(nodeFile, 1)
  If Not stream.AtEndOfStream Then nodeExe = Trim(stream.ReadLine)
  stream.Close
  If Not fso.FileExists(nodeExe) Then nodeExe = "node"
End If
cmd = "cmd.exe /d /c """"" & nodeExe & """ """ & repo & "\scripts\windows\efesto-windows-stack.mjs"" " & action & " >> """ & logs & "\launcher.log"" 2>&1"""
code = shell.Run(cmd, 0, True)
If code <> 0 And Not quiet Then
  MsgBox "Efesto no pudo " & IIf(action = "stop", "detenerse", "arrancar") & "." & vbCrLf & vbCrLf & _
    "Revisa el registro: " & logs & "\launcher.log" & vbCrLf & _
    "Si falta algo, vuelve a ejecutar EfestoSetup.exe (lo ya instalado no se repite).", vbExclamation, "Efesto"
End If
WScript.Quit code

Function IIf(cond, a, b)
  If cond Then IIf = a Else IIf = b
End Function
