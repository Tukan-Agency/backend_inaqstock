// src/routes/balanceRouter.ts
import express from "express";
import * as balanceController from "../controllers/balanceController";
import authenticate from "../middleware/auth";

const balanceRouter = express.Router();

// Todas las rutas requieren autenticación
balanceRouter.use(authenticate);

// GET /api/balance - Obtener balances calculados del usuario
balanceRouter.get("/", balanceController.getUserBalances);

// GET /api/balance/preferences - Obtener preferencias de visualización
balanceRouter.get("/preferences", balanceController.getBalancePreferences);

// PUT /api/balance/preferences - Actualizar preferencias de visualización
balanceRouter.put("/preferences", balanceController.updateBalancePreferences);

export default balanceRouter;