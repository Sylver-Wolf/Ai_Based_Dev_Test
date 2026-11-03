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

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

### Mises à jour automatiques (Windows)

Les versions Windows installées vérifient les releases GitHub au démarrage et
téléchargent les mises à jour en arrière-plan. Lorsque le téléchargement est
terminé, l’application propose de redémarrer pour installer la nouvelle version ;
choisir « Plus tard » laisse l’application continuer sans installer la mise à jour.

Pour publier une mise à jour, augmentez `version` dans `package.json`, puis créez
et poussez le tag correspondant (`vX.Y.Z`). Le workflow Windows publie alors
l’installateur et les métadonnées nécessaires sur la release GitHub. Les releases
doivent être accessibles à l’application installée. Les mises à jour automatiques
sont désactivées en développement et ne sont configurées ici que pour Windows.

### Tests

```bash
# Run tests in watch mode
$ npm run test

# Run tests once
$ npm run test:run

# Run tests once and generate coverage reports in coverage/
$ npm run test:coverage
```
