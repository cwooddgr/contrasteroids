#!/bin/sh
# Builds arcade/build/Contrasteroids.app, universal (Intel and Apple silicon), macOS 12+.
set -e
cd "$(dirname "$0")"
APP=build/Contrasteroids.app
rm -rf build && mkdir -p "$APP/Contents/MacOS"
for arch in x86_64 arm64; do
  swiftc -swift-version 5 -O -target "$arch-apple-macos12.0" -framework WebKit main.swift -o "build/Contrasteroids-$arch"
done
lipo -create build/Contrasteroids-x86_64 build/Contrasteroids-arm64 -output "$APP/Contents/MacOS/Contrasteroids"
rm build/Contrasteroids-*
cp Info.plist "$APP/Contents/"
codesign --force --sign - "$APP"
echo "built $APP"
