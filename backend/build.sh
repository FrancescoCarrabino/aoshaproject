#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

echo "--- [BUILD SCRIPT] Starting backend setup in $(pwd) ---"
# Install sqlite3 from source, then rest of backend dependencies
npm_config_build_from_source=true npm install sqlite3
npm install
echo "--- [BUILD SCRIPT] Backend dependencies installed ---"

echo "--- [BUILD SCRIPT] Moving to frontend directory ---"
cd ../frontend
echo "--- [BUILD SCRIPT] Current directory: $(pwd) ---"
npm install
echo "--- [BUILD SCRIPT] Frontend dependencies installed ---"

echo "--- [BUILD SCRIPT] Building frontend application ---"
npx vite build
echo "--- [BUILD SCRIPT] Frontend build complete. Checking frontend/dist: ---"
ls -la ./dist

echo "--- [BUILD SCRIPT] Moving back to backend directory ---"
cd ../backend
echo "--- [BUILD SCRIPT] Current directory: $(pwd) ---"

echo "--- [BUILD SCRIPT] Creating target directory for frontend assets ---"
mkdir -p ./public/react-app

echo "--- [BUILD SCRIPT] Copying frontend assets to backend ---"
cp -R ../frontend/dist/* ./public/react-app/
echo "--- [BUILD SCRIPT] Frontend assets copied. Checking backend/public/react-app: ---"
ls -la ./public/react-app

echo "--- [BUILD SCRIPT] Build script finished successfully! ---"
