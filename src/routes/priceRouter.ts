import { Router } from "express";
import { getLastPrice, streamLivePriceSSE } from "../controllers/priceController"; // si ya existía
import { getCryptoLastPrice, streamCryptoPriceSSE } from "../controllers/cryptoPriceController";

const router = Router();

// Rutas existentes (stub/general)
router.get("/last", getLastPrice);
router.get("/stream", streamLivePriceSSE);

// Rutas nuevas para CRYPTO con precio real vía Polygon REST
router.get("/crypto/last", getCryptoLastPrice);
router.get("/crypto/stream", streamCryptoPriceSSE);

export default router;