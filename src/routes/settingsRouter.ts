import { Router } from "express";
import { getSettings, updateSettings, uploadLogo } from "../controllers/settingsController";
import upload from "../middleware/uploadMiddleware"; // Reutilizamos tu middleware existente

const router = Router();

// Rutas
router.get("/", getSettings);
router.post("/update", updateSettings);
router.post("/upload-logo", upload.fields([{ name: 'logoLight', maxCount: 1 }, { name: 'logoDark', maxCount: 1 }]), uploadLogo);


export default router;