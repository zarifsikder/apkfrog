#!/bin/bash
set -e
SRC=/home/z/my-project
OUT=/home/z/my-project/download/ApkForge-Vercel-Ready.zip
rm -f "$OUT"
STAGE=$(mktemp -d)
mkdir -p "$STAGE/ApkForge"

cd "$SRC"
cp .env.example "$STAGE/ApkForge/"
cp .gitignore "$STAGE/ApkForge/"
cp components.json "$STAGE/ApkForge/"
cp eslint.config.mjs "$STAGE/ApkForge/"
cp next.config.ts "$STAGE/ApkForge/"
cp next-env.d.ts "$STAGE/ApkForge/"
cp package.json "$STAGE/ApkForge/"
cp postcss.config.mjs "$STAGE/ApkForge/"
cp tailwind.config.ts "$STAGE/ApkForge/"
cp tsconfig.json "$STAGE/ApkForge/"
cp vercel.json "$STAGE/ApkForge/"
cp README.md "$STAGE/ApkForge/"
cp bun.lock "$STAGE/ApkForge/" 2>/dev/null || true

cp -r src "$STAGE/ApkForge/"
cp -r prisma "$STAGE/ApkForge/"
cp -r public "$STAGE/ApkForge/"

# Keep keystore (needed for APK signing)
mkdir -p "$STAGE/ApkForge/db/keystore"
cp db/keystore/wevlo-release.jks "$STAGE/ApkForge/db/keystore/" 2>/dev/null || true

# Remove any local artifacts
rm -rf "$STAGE/ApkForge/prisma/sqlite-client" 2>/dev/null || true

cd "$STAGE"
zip -r -q "$OUT" ApkForge/
rm -rf "$STAGE"
ls -lh "$OUT"
echo "Done."
