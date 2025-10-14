import path from "path";
import fs from "fs";

// Puedes configurar una ruta absoluta por env si quieres:
// UPLOADS_DIR=/var/www/myapp/uploads
const ENV_DIR = process.env.UPLOADS_DIR && process.env.UPLOADS_DIR.trim();

export const UPLOADS_DIR = ENV_DIR
  ? path.resolve(ENV_DIR)
  : path.resolve(process.cwd(), "uploads"); // siempre la misma carpeta "uploads" en la raíz del proyecto

// Aseguramos que exista
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}