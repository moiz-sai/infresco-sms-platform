; Infresco SMS one-click installer (SPEC T11). Built by .github/workflows/windows-installer.yml:
; the workflow fills installer\build\ (node, pgsql, app, service, redist) and runs ISCC on this file.
#define AppName "Infresco SMS"
#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif

[Setup]
AppId={{6F1D2A4E-9C3B-4E7A-8D25-1B7C0E5A9F31}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=Infresco
DefaultDirName={autopf}\Infresco SMS
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir=output
OutputBaseFilename=InfrescoSMS-Setup-{#AppVersion}
SetupIconFile=assets\app.ico
UninstallDisplayIcon={app}\assets\app.ico
UninstallDisplayName={#AppName}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
CloseApplications=no

[Tasks]
Name: "demodata"; Description: "Load demo data (300 sample students) - for testing and demos only"; Flags: unchecked

[Files]
Source: "build\node\*"; DestDir: "{app}\node"; Flags: recursesubdirs ignoreversion
Source: "build\pgsql\*"; DestDir: "{app}\pgsql"; Flags: recursesubdirs ignoreversion
Source: "build\app\*"; DestDir: "{app}\app"; Flags: recursesubdirs ignoreversion
Source: "build\service\InfrescoSMS-App.exe"; DestDir: "{app}\service"; Flags: ignoreversion
Source: "build\redist\vc_redist.x64.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "setup\*"; DestDir: "{app}\setup"; Flags: ignoreversion
Source: "assets\app.ico"; DestDir: "{app}\assets"; Flags: ignoreversion

[Icons]
Name: "{autodesktop}\{#AppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\setup\launch.vbs"""; IconFilename: "{app}\assets\app.ico"; Comment: "Open the school office system"
Name: "{autoprograms}\{#AppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\setup\launch.vbs"""; IconFilename: "{app}\assets\app.ico"

[Run]
Filename: "{sys}\wscript.exe"; Parameters: """{app}\setup\launch.vbs"""; Description: "Open {#AppName} now"; Flags: postinstall nowait skipifsilent
Filename: "notepad.exe"; Parameters: """{commonappdata}\InfrescoSMS\first-login.txt"""; Description: "Show the first-login sheet (usernames and passwords)"; Flags: postinstall nowait skipifsilent; Check: SheetExists

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\setup\uninstall.ps1"" -AppDir ""{app}"""; Flags: runhidden waituntilterminated; RunOnceId: "RemoveServices"

[Messages]
FinishedLabel=Infresco SMS is installed and running. It starts by itself whenever this computer is turned on.%n%nData and backups are kept in C:\ProgramData\InfrescoSMS.

[Code]
var
  SetupFailed: Boolean;

function VCRedistNeeded: Boolean;
var
  Installed: Cardinal;
begin
  Result := not (RegQueryDWordValue(HKLM64, 'SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64', 'Installed', Installed) and (Installed = 1));
end;

function SheetExists: Boolean;
begin
  Result := FileExists(ExpandConstant('{commonappdata}\InfrescoSMS\first-login.txt'));
end;

procedure StopService(const Name: String);
var
  Code: Integer;
begin
  Exec(ExpandConstant('{sys}\sc.exe'), 'stop ' + Name, '', SW_HIDE, ewWaitUntilTerminated, Code);
end;

// Upgrade: the running services lock files in {app}; stop them before copying.
function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  StopService('InfrescoSMS-App');
  StopService('InfrescoSMS-DB');
  Sleep(4000);
  Result := '';
end;

// After files and the VC++ runtime: create the database, services, firewall rule, backups.
procedure CurStepChanged(CurStep: TSetupStep);
var
  Code: Integer;
  Params: String;
begin
  if CurStep = ssPostInstall then
  begin
    // PostgreSQL needs the Visual C++ runtime; install it first if this PC lacks it.
    if VCRedistNeeded then
    begin
      WizardForm.StatusLabel.Caption := 'Installing Microsoft Visual C++ runtime...';
      Exec(ExpandConstant('{tmp}\vc_redist.x64.exe'), '/install /quiet /norestart', '', SW_HIDE, ewWaitUntilTerminated, Code);
    end;
    WizardForm.StatusLabel.Caption := 'Setting up the database and services (2-4 minutes, demo data adds about 1 minute)...';
    Params := '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\setup\install.ps1') + '" -AppDir "' + ExpandConstant('{app}') + '"';
    if WizardIsTaskSelected('demodata') then
      Params := Params + ' -DemoData';
    if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'), Params, '', SW_HIDE, ewWaitUntilTerminated, Code) or (Code <> 0) then
    begin
      SetupFailed := True;
      SuppressibleMsgBox('Setup could not finish (code ' + IntToStr(Code) + ').' + #13#10#13#10 +
        'Please send this file to support:' + #13#10 + ExpandConstant('{commonappdata}\InfrescoSMS\logs\install.log'),
        mbCriticalError, MB_OK, IDOK);
    end;
  end;
end;

// Silent installs (CI, remote setup) report failure through the exit code.
function GetCustomSetupExitCode: Integer;
begin
  if SetupFailed then Result := 1 else Result := 0;
end;
