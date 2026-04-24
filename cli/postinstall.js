/**
 * postinstall.js
 * Runs automatically after: npm install -g internx-cli
 * Registers internx:// as a custom URL protocol on the OS
 * so browser buttons can launch the CLI directly.
 */

const os   = require('os');
const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const platform = os.platform();

function getCliBinPath() {
  try {
    if (platform === 'win32') {
      return execSync('where internx').toString().trim().split('\n')[0].trim();
    }
    return execSync('which internx').toString().trim();
  } catch {
    return path.resolve(__dirname, '..', 'bin', 'internx.js');
  }
}

function getJsBinPath(binPath) {
  // 'where internx' returns the .cmd shim on Windows.
  // We need the actual .js entry point that node can execute directly.
  // npm global installs put modules at: <prefix>/node_modules/<pkg>/
  // The .cmd shim lives at:            <prefix>/internx.cmd
  // So node_modules is a sibling of the shim's directory.
  const candidates = [
    path.resolve(path.dirname(binPath), 'node_modules', 'internx-cli', 'bin', 'internx.js'),
    path.resolve(path.dirname(binPath), '..', 'node_modules', 'internx-cli', 'bin', 'internx.js'),
    path.resolve(__dirname, '..', 'bin', 'internx.js'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return binPath;
}

function registerWindows(binPath) {
  const nodePath = process.execPath; // e.g. C:\Program Files\nodejs\node.exe
  const jsBin    = getJsBinPath(binPath);

  // Write a .bat launcher with fully resolved hardcoded paths.
  // When Windows invokes the protocol handler from the browser it runs in a
  // minimal environment with no PATH inheritance — absolute paths only.
  const batDir  = path.join(os.homedir(), '.internx');
  const batPath = path.join(batDir, 'launch.bat');

  if (!fs.existsSync(batDir)) fs.mkdirSync(batDir, { recursive: true });

  const bat = '@echo off\r\n'
    + `"${nodePath}" "${jsBin}" url %1\r\n`;

  fs.writeFileSync(batPath, bat, 'utf8');
  console.log(`   Launcher written : ${batPath}`);
  console.log(`   Node             : ${nodePath}`);
  console.log(`   Script           : ${jsBin}`);

  const command = `"${batPath}" "%1"`;
  const escaped = command.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  const regContent = `Windows Registry Editor Version 5.00

[HKEY_CLASSES_ROOT\\internx]
@="InternX Protocol"
"URL Protocol"=""

[HKEY_CLASSES_ROOT\\internx\\DefaultIcon]
@="${binPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"

[HKEY_CLASSES_ROOT\\internx\\shell]

[HKEY_CLASSES_ROOT\\internx\\shell\\open]

[HKEY_CLASSES_ROOT\\internx\\shell\\open\\command]
@="${escaped}"
`;

  const regFile = path.join(os.tmpdir(), 'internx-protocol.reg');
  fs.writeFileSync(regFile, regContent, 'utf8');

  try {
    execSync(`regedit /s "${regFile}"`, { stdio: 'ignore' });
    console.log('✅ internx:// protocol registered on Windows');
  } catch (err) {
    console.log('⚠️  Could not auto-register protocol on Windows.');
    console.log('   Run as Administrator, or manually import:', regFile);
  }
}

function registerMac(binPath) {
  const appDir      = path.join(os.homedir(), 'Applications', 'InternX.app');
  const contentsDir = path.join(appDir, 'Contents');
  const macOSDir    = path.join(contentsDir, 'MacOS');
  const nodePath    = process.execPath;

  fs.mkdirSync(macOSDir, { recursive: true });

  const launcher = `#!/bin/bash\n"${nodePath}" "${binPath}" url "$1"\n`;
  const launcherPath = path.join(macOSDir, 'internx-launcher');
  fs.writeFileSync(launcherPath, launcher);
  execSync(`chmod +x "${launcherPath}"`);

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key>
  <string>com.internx.cli</string>
  <key>CFBundleName</key>
  <string>InternX</string>
  <key>CFBundleExecutable</key>
  <string>internx-launcher</string>
  <key>CFBundleURLTypes</key>
  <array>
    <dict>
      <key>CFBundleURLName</key>
      <string>InternX Protocol</string>
      <key>CFBundleURLSchemes</key>
      <array>
        <string>internx</string>
      </array>
    </dict>
  </array>
</dict>
</plist>`;

  fs.writeFileSync(path.join(contentsDir, 'Info.plist'), plist);

  try {
    execSync(`/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "${appDir}"`, { stdio: 'ignore' });
    console.log('✅ internx:// protocol registered on macOS');
    console.log(`   Helper app: ${appDir}`);
  } catch {
    console.log('⚠️  Could not auto-register on macOS.');
    console.log(`   Try opening the app manually once: open "${appDir}"`);
  }
}

function registerLinux(binPath) {
  const nodePath = process.execPath;
  const appsDir  = path.join(os.homedir(), '.local', 'share', 'applications');

  fs.mkdirSync(appsDir, { recursive: true });

  const desktopEntry = `[Desktop Entry]
Name=InternX
Comment=InternX CLI Protocol Handler
Exec="${nodePath}" "${binPath}" url %u
Type=Application
NoDisplay=true
MimeType=x-scheme-handler/internx;
`;

  const desktopPath = path.join(appsDir, 'internx.desktop');
  fs.writeFileSync(desktopPath, desktopEntry);

  try {
    execSync(`xdg-mime default internx.desktop x-scheme-handler/internx`, { stdio: 'ignore' });
    execSync(`update-desktop-database "${appsDir}"`, { stdio: 'ignore' });
    console.log('✅ internx:// protocol registered on Linux');
  } catch {
    console.log('⚠️  Could not auto-register on Linux.');
    console.log('   Try manually: xdg-mime default internx.desktop x-scheme-handler/internx');
  }
}

// ── Main ──
console.log('\n🔧 InternX CLI — Registering internx:// protocol...');

try {
  const binPath = getCliBinPath();

  if (platform === 'win32')       registerWindows(binPath);
  else if (platform === 'darwin') registerMac(binPath);
  else                            registerLinux(binPath);

  console.log('\n📦 InternX CLI installed successfully!');
  console.log('   Run: internx --help\n');
} catch (err) {
  console.log('⚠️  Protocol registration skipped:', err.message);
  console.log('   CLI still works — run: internx setup --help\n');
}