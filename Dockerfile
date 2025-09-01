FROM node:20-alpine

WORKDIR /app

# Copia primero solo los archivos de dependencias
COPY package.json yarn.lock ./

# Instala dependencias (incluyendo devDependencies)
RUN yarn install --frozen-lockfile

# Copia el resto del código
COPY . .

# Puerto que usa tu aplicación
EXPOSE 3000

# Comando para desarrollo (usando el script "dev" de tu package.json)
CMD ["yarn", "run", "dev"]