#!/bin/sh
# Run the minimal frontend setup (Python's built-in webserver, direct WSGI server access to backend without nginx reverse proxy) for development purposes.
# Make sure to run the `run_backend_dev_minimal.sh` script to start the backend with proper settings.

# backend dir known, copy the correct frontend config for direct backend access without nginx reverse proxy in place
FRONTEND_CONFIG_PATH="./dev_tools/local_minimal/frontend_settings/tud_settings.dev-minimal.js"

if [ ! -f "$FRONTEND_CONFIG_PATH" ]; then
  echo "ERROR: Frontend config file not found at '$FRONTEND_CONFIG_PATH', please check the backend repository for the correct path."
  exit 1
fi

FRONTEND_TARGET_PATH="frontend/src/settings"

if [ ! -d "$FRONTEND_TARGET_PATH" ]; then
  echo "ERROR: Frontend target directory '$FRONTEND_TARGET_PATH' does not exist, please ensure you are running this script from the frontend repo root."
  exit 1
fi

cp "$FRONTEND_CONFIG_PATH" "${FRONTEND_TARGET_PATH}/tud_settings.js" || { echo "ERROR: Failed to copy frontend config file, please check the paths and permissions."; exit 1; }
echo "Starting minimal frontend development server on http://localhost:3000 with direct backend access..."

cd frontend/src/ && python3 -m http.server 3000

