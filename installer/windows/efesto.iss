; EfestoSetup.exe — instalador de Efesto para Windows (Inno Setup 6), compilado en CI
; (.github/workflows/windows-installer.yml). Instalación por usuario, sin administrador, en
; %LOCALAPPDATA%\Efesto. Copia el código de Efesto y ejecuta oculto
; scripts\windows\install-efesto-windows.ps1 mostrando el progreso en español.
; La extensión del navegador NO forma parte de este flujo. Sin firma de código (pendiente).

#ifndef AppVersion
  #define AppVersion "0.1.0"
#endif
#ifndef SourceDir
  #define SourceDir "..\..\build\efesto-src"
#endif
#ifndef OutputDir
  #define OutputDir "..\..\build\installer"
#endif

[Setup]
AppId={{6E7B3C1A-9F2D-4C8E-A5B1-EF35700A0001}
AppName=Efesto
AppVersion={#AppVersion}
AppVerName=Efesto {#AppVersion}
AppPublisher=Efesto
DefaultDirName={localappdata}\Efesto\app
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableReadyPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir={#OutputDir}
OutputBaseFilename=EfestoSetup
SetupIconFile=efesto.ico
UninstallDisplayIcon={app}\installer\windows\efesto.ico
UninstallDisplayName=Efesto
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
SetupLogging=yes
CloseApplications=no
RestartApplications=no

[Languages]
Name: "es"; MessagesFile: "compiler:Languages\Spanish.isl"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{userdesktop}\Efesto"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\scripts\windows\efesto-launch.vbs"" open"; WorkingDir: "{app}"; IconFilename: "{app}\installer\windows\efesto.ico"; Comment: "Abre Efesto"
Name: "{userprograms}\Efesto\Efesto"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\scripts\windows\efesto-launch.vbs"" open"; WorkingDir: "{app}"; IconFilename: "{app}\installer\windows\efesto.ico"; Comment: "Abre Efesto"
Name: "{userprograms}\Efesto\Detener Efesto"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\scripts\windows\efesto-launch.vbs"" stop"; WorkingDir: "{app}"; IconFilename: "{app}\installer\windows\efesto.ico"; Comment: "Detiene Efesto"
Name: "{userprograms}\Efesto\Desinstalar Efesto"; Filename: "{uninstallexe}"

[Run]
Filename: "{sys}\wscript.exe"; Parameters: """{app}\scripts\windows\efesto-launch.vbs"" open"; Description: "Abrir Efesto ahora"; Flags: postinstall nowait skipifsilent; Check: SetupSucceeded

[UninstallRun]
Filename: "{sys}\wscript.exe"; Parameters: """{app}\scripts\windows\efesto-launch.vbs"" stop /quiet"; Flags: runhidden waituntilterminated; RunOnceId: "StopEfesto"

[UninstallDelete]
; Lo generado tras la instalación (node_modules, .next, dist) dentro de la carpeta del programa.
Type: filesandordirs; Name: "{app}"

[Code]
const
  MaxWaitMs = 10800000; { 3 h: la primera vez descarga Python, Hermes, dependencias y el modelo }

var
  ProgressPage: TOutputProgressWizardPage;
  InstallOk: Boolean;

function SetupSucceeded: Boolean;
begin
  Result := InstallOk;
end;

function StepLabel(N: Integer): String;
begin
  case N of
    1: Result := 'Comprobando Git, Node.js, Python 3.14 y Ollama (se instalan solo para tu usuario si faltan)';
    2: Result := 'Instalando Hermes Agent (versión fijada ae3f9f9c)';
    3: Result := 'Preparando el modelo local (la primera vez descarga unos 2-3 GB)';
    4: Result := 'Instalando el Kernel de Efesto';
    5: Result := 'Preparando el panel de Efesto (compilación de producción)';
    6: Result := 'Guardando la configuración local';
    7: Result := 'Creando los accesos directos';
    8: Result := 'Preparando el arranque';
    9: Result := 'Comprobación final';
  else
    Result := 'Instalando Efesto';
  end;
end;

function LogPath: String;
begin
  Result := ExpandConstant('{localappdata}\Efesto\logs\instalacion.log');
end;

{ Progress file lines (ASCII): "STEP|n|total|..." or "DONE|code|...". }
function FieldAt(const Line: String; Index: Integer): String;
var
  Rest: String;
  P, I: Integer;
begin
  Rest := Line;
  for I := 1 to Index do
  begin
    P := Pos('|', Rest);
    if P = 0 then begin Result := ''; Exit; end;
    Rest := Copy(Rest, P + 1, Length(Rest));
  end;
  P := Pos('|', Rest);
  if P > 0 then Result := Copy(Rest, 1, P - 1) else Result := Rest;
end;

procedure RunEfestoInstall;
var
  ProgressFile, Params, Line: String;
  Raw: AnsiString;
  ResultCode, Waited, Step, Total: Integer;
  Done: Boolean;
begin
  InstallOk := False;
  ProgressFile := ExpandConstant('{localappdata}\Efesto\install-progress.txt');
  ForceDirectories(ExpandConstant('{localappdata}\Efesto\logs'));
  DeleteFile(ProgressFile);
  Params := '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + ExpandConstant('{app}\scripts\windows\install-efesto-windows.ps1') +
    '" -SkipShortcuts -NoStart -ProgressFile "' + ProgressFile + '" -LogFile "' + LogPath + '"';
  { /DRYRUN=1 (solo CI): copia y registra los archivos; el script se ejecuta en simulación. }
  if ExpandConstant('{param:DRYRUN|0}') = '1' then Params := Params + ' -DryRun';
  ProgressPage := CreateOutputProgressPage('Instalando Efesto', 'Esto solo pasa la primera vez y puede tardar un rato. No hace falta que hagas nada.');
  if not WizardSilent then
  begin
    ProgressPage.SetText('Empezando...', '');
    ProgressPage.SetProgress(0, 9);
    ProgressPage.Show;
  end;
  try
    if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'), Params, ExpandConstant('{app}'), SW_HIDE, ewNoWait, ResultCode) then
    begin
      MsgBox('No se pudo iniciar la instalación de Efesto (PowerShell no disponible).', mbError, MB_OK);
      Exit;
    end;
    Done := False;
    Waited := 0;
    Step := 0;
    Total := 9;
    while (not Done) and (Waited < MaxWaitMs) do
    begin
      Sleep(500);
      Waited := Waited + 500;
      if LoadStringFromFile(ProgressFile, Raw) then
      begin
        Line := Trim(String(Raw));
        if Copy(Line, 1, 5) = 'STEP|' then
        begin
          Step := StrToIntDef(FieldAt(Line, 1), Step);
          Total := StrToIntDef(FieldAt(Line, 2), Total);
          if Total < 1 then Total := 9;
        end
        else if Copy(Line, 1, 5) = 'DONE|' then
        begin
          Done := True;
          InstallOk := FieldAt(Line, 1) = '0';
        end;
      end;
      if not WizardSilent then
      begin
        ProgressPage.SetText(StepLabel(Step), 'Paso ' + IntToStr(Step) + ' de ' + IntToStr(Total));
        if Step > 0 then ProgressPage.SetProgress(Step - 1, Total);
      end;
    end;
    if InstallOk then
    begin
      if not WizardSilent then ProgressPage.SetProgress(Total, Total);
    end
    else if not Done then
      MsgBox('La instalación de Efesto tardó demasiado.' + #13#10 + 'Registro: ' + LogPath + #13#10 + 'Puedes volver a ejecutar EfestoSetup.exe: lo ya instalado no se repite.', mbError, MB_OK)
    else
      MsgBox('Efesto necesita atención y no terminó de instalarse.' + #13#10 + 'Registro: ' + LogPath + #13#10 + 'Puedes volver a ejecutar EfestoSetup.exe: lo ya instalado no se repite.', mbError, MB_OK);
  finally
    if not WizardSilent then ProgressPage.Hide;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then RunEfestoInstall;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if (CurUninstallStep = usPostUninstall) and (not UninstallSilent) then
  begin
    if MsgBox('¿Borrar también tus datos de Efesto (Kernel, Hermes de Efesto, registros) en ' + ExpandConstant('{localappdata}\Efesto') + '?' + #13#10 +
      'Si eliges No, se conservan para una futura reinstalación.', mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
      DelTree(ExpandConstant('{localappdata}\Efesto'), True, True, True);
  end;
end;
