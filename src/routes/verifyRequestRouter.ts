import express from "express";
import upload from "../middleware/uploadMiddleware";
import {
  createVerifyRequest,
  getAllVerifyRequests,
  toggleCuentaVerify, // 👈 nueva función importada
} from "../controllers/verifyRequestController";

const router = express.Router();

// 📬 Crear nueva solicitud
router.post("/", upload.single("file"), createVerifyRequest);

// 📥 Obtener todas las solicitudes
router.get("/", getAllVerifyRequests);

// 🔄 Alternar estado de verificación (true/false)
router.put("/:id/toggle", toggleCuentaVerify); // 👈 nueva ruta

export default router;
