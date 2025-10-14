import multer from "multer";
import path from "path";
import { UPLOADS_DIR } from "../config/paths";

// ⚙️ Configuración de Multer
const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (_req, file, cb) {
    const uniqueSuffix = Date.now();
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    const safeName = base.replace(/[^a-zA-Z0-9_-]/g, "_");
    cb(null, `${safeName}-${uniqueSuffix}${ext}`);
  },
});

// 🎯 Filtro para permitir solo imágenes y PDFs
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ["image/jpeg", "image/png", "application/pdf"];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Formato no permitido. Solo se aceptan JPG, PNG o PDF."));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // máximo 10 MB
});

export default upload;