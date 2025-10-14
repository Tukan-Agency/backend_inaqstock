import { Router } from "express";
import authenticate from "../middleware/auth";
import requireAdmin from "../middleware/requireAdmin";
import upload from "../middleware/uploadMiddleware";
import {
  getMyVerification,
  uploadMyDocument,
  getAdminRequests,
  getUserVerification,
  adminUploadDocument,
  approveDocument,
  rejectDocument,
  setGlobalVerification,
} from "../controllers/verificationController";

const router = Router();

// Todas requieren autenticación
router.use(authenticate);

// Usuario
router.get("/me", getMyVerification);
router.post("/documents/:docType", upload.single("file"), uploadMyDocument);

// Admin
router.get("/admin/requests", requireAdmin, getAdminRequests);
router.get("/admin/:userId", requireAdmin, getUserVerification);
router.post("/admin/:userId/documents/:docType/upload", requireAdmin, upload.single("file"), adminUploadDocument);
router.put("/admin/:userId/documents/:docType/approve", requireAdmin, approveDocument);
router.put("/admin/:userId/documents/:docType/reject", requireAdmin, rejectDocument);
router.put("/admin/:userId/global", requireAdmin, setGlobalVerification);

export default router;