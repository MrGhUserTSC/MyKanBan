This folder contains local start and stop scripts for Windows, macOS, and Linux.

Current convention:

- Each start script builds the Docker image and runs a container named `pm-app`.
- Each stop script stops and removes the `pm-app` container if it exists.
- Scripts are intentionally simple so local setup stays easy to debug.
