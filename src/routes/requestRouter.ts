import { Router } from "express";
import {
  createRequest,
  getAllRequests,
  updateRequestStatus,
} from "../controllers/requestController";

// Si necesitas proteger las rutas con auth admin, coloca tu middleware aquí.
// import authenticate from "../middleware/auth";
// import requireAdmin from "../middleware/requireAdmin";

const router = Router();

// router.use(authenticate, requireAdmin);

router.post("/new", createRequest);
router.get("/all", getAllRequests);
router.post("/update/status", updateRequestStatus);

export default router;