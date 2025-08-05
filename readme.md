# TypeScript Ultra speed Bakcend API

Infrasctura de proyecto de alta velocidad desarrado en typescript para empresa inaqstock

## Features

- [TypeScript](https://www.typescriptlang.org/) (v4)
- [ts-node-dev](https://github.com/wclr/ts-node-dev)
- [Prettier](https://prettier.io/)
- [ESLint](https://eslint.org/) with:
  - [Codely's config](https://github.com/lydell/eslint-plugin-simple-import-sort/) (includes ESLint's recommended rules, Prettier, Import plugin and more)
  - [Jest plugin](https://www.npmjs.com/package/eslint-plugin-jest)
- [Jest](https://jestjs.io) with [DOM Testing Library](https://testing-library.com/docs/dom-testing-library/intro)
- [GitHub Action workflows](https://github.com/features/actions) set up to run tests and linting on push

## Running the app

```
# Instalación de dependencias
yarn install

# Ejecución en el  port 3000
yarn dev

# Compilación de la aplicación
yarn build

# Ejecución del proyecto en modo compilación port 3000
yarn start
```

## Testing

### Jest with supertest

```
npm run test
```

## Linting

```
# run linter
npm run lint

# fix lint issues
npm run lint:fix
```
### Archivo Env
El archivo .env contiene las variables de entorno para la aplicación. para poder configuralo, ubicarlo en el arhchivo .env.example y renombrarlo a .env