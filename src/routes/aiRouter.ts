import { Router } from "express";
import { searchSymbol } from "../controllers/aiController";

const router = Router();

// POST /api/ai/search-symbol
router.post("/search-symbol", searchSymbol);

export default router;