import { Router } from "express";
import { getCryptoLastPrice, streamCryptoPriceSSE } from "../controllers/cryptoPriceController";

const router = Router();

// Quedan montadas en /api/prices/crypto
router.get("/last", getCryptoLastPrice);
router.get("/stream", streamCryptoPriceSSE);

export default router;