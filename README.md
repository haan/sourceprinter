# sourceprinter

Source Printer turns a zip full of student coding projects into syntax-highlighted PDFs. It parses the zip in the browser for preview, then sends the zip and settings to a stateless Node backend that renders PDFs and streams the download. Any programming language with a recognized file extension is supported.

- Docker image: https://hub.docker.com/r/haanlaurent/sourceprinter

## Features
- Upload a zip containing multiple top-level project folders.
- Configure the project folder level when the zip nests projects deeper.
- Supports 40+ file extensions: `.java`, `.py`, `.js`, `.ts`, `.c`, `.cpp`, `.cs`, `.go`, `.rs`, `.rb`, `.php`, `.swift`, `.kt`, `.scala`, and many more.
- Parse embedded `.umz` archives (created by Unimozer Next) inside the uploaded zip (one nesting level; nested `.umz` inside `.umz` are ignored).
- Ignore hidden/macOS metadata files (for example entries under `__MACOSX` and files whose basename starts with `.`).
- Overview grouped by project, sorted by project then file name.
- Preview with adjustable font size, line height, color scheme, and font family.
- Language-agnostic filters: remove comments, collapse blank lines, tabs to spaces.
- Language-specific filters shown dynamically based on detected languages (e.g. Java: Remove Javadoc, Hide initComponents(), Hide main()).
- Per-file include checkboxes with preview selection.
- Output as a single PDF or a zip of per-project PDFs, with optional per-project page padding.
- Optional headers (project and file name/full path) and footer page numbers.
- Render progress with a live radial indicator (per-file progress).
- Highlighting via highlight.js with built-in themes: atom-one-light, arduino-light, stackoverflow-light, vs, monochrome.
- Settings persist in localStorage with a reset-to-defaults action.
- No files retained on the server (temp files are deleted after each request).

## Run with Docker

Run the latest published image from Docker Hub:
https://hub.docker.com/r/haanlaurent/sourceprinter

```bash
docker run --rm -p 8080:8080 haanlaurent/sourceprinter:latest
```

Then open: http://localhost:8080

Run a specific version tag:

```bash
docker run --rm -p 8080:8080 haanlaurent/sourceprinter:v0.11.0
```

Build and run locally from this repository:

```bash
docker build -t sourceprinter:local .
docker run --rm -p 8080:8080 sourceprinter:local
```

## Deployment

See `deploy/README-DEPLOY.md`.

## Related Project

Unimozer Next: https://github.com/haan/UnimozerNext
