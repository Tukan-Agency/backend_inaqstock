import { Router } from "express";
import { getOverview } from "../controllers/dashboardController";

const router = Router();

// GET /api/dashboard/overview
router.get("/overview", getOverview);

export default router;