# Ai Based Dev Test

An Electron application with React and TypeScript.

The objective of this repo and project is not to create a beautifull app, but solely to understand how to guide an ai to create what i want, and to learn the basics of basics to create a more robust app in the future.

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm ci
```

### Development

```bash
$ npm run dev
```

In development, saved text is stored in `test-data/saved-inputs.json` at the
project root. The installed application continues to use its own user data
directory. The development Electron profile (Chromium cache, local storage, etc.)
is also isolated in a separate user data directory with a `-dev` suffix, so both
versions can run at the same time, without polluting eachother.

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

### Automatic updates (Windows)

Installed Windows versions check GitHub releases at startup and download updates
in the background. Once a download is complete, the application asks whether to
restart and install the new version. Choosing "Later" keeps the application
running without installing the update.

To publish an update, increment `version` in `package.json`, then create and push
the corresponding tag (`vX.Y.Z`). The Windows workflow publishes the installer
and required metadata to the GitHub release. Releases must be accessible to the
installed application. Automatic updates are disabled in development and are
currently configured for Windows only.

### Tests

```bash
# Run tests in watch mode
$ npm run test

# Run tests once
$ npm run test:run

# Run tests once and generate coverage reports in coverage/
$ npm run test:coverage
```
