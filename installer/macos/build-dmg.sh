#!/bin/bash
# Builds build/macos/Efesto.dmg: Efesto.app (launcher) with the tracked sources embedded. Unsigned.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; OUT="$ROOT/build/macos"; SHA="$(git -C "$ROOT" rev-parse --short HEAD)"
rm -rf "$OUT"; APPB="$OUT/stage/Efesto.app/Contents"; mkdir -p "$APPB/MacOS" "$APPB/Resources/efesto-src"
git -C "$ROOT" archive HEAD | tar -x -C "$APPB/Resources/efesto-src"
git -C "$ROOT" rev-parse HEAD > "$APPB/Resources/efesto-src/BUILD_COMMIT.txt"
cp "$ROOT/scripts/macos/efesto-launch.sh" "$APPB/Resources/efesto-src/scripts/macos/efesto-launch.sh"
cat > "$APPB/MacOS/Efesto" <<'SH'
#!/bin/bash
exec bash "$(dirname "$0")/../Resources/efesto-src/scripts/macos/efesto-launch.sh" open
SH
chmod +x "$APPB/MacOS/Efesto" "$APPB/Resources/efesto-src/scripts/macos/"*.sh
cat > "$APPB/Info.plist" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>Efesto</string><key>CFBundleIdentifier</key><string>os.internetbrain.efesto</string>
<key>CFBundleExecutable</key><string>Efesto</string><key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.1.0</string><key>CFBundleVersion</key><string>0.1.0-$SHA</string>
<key>LSMinimumSystemVersion</key><string>12.0</string>
</dict></plist>
PL
ln -s /Applications "$OUT/stage/Applications"
hdiutil create -quiet -volname "Efesto" -srcfolder "$OUT/stage" -ov -format UDZO "$OUT/Efesto.dmg"
ls -l "$OUT/Efesto.dmg"
