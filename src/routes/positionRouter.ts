import express from "express";
import * as positionController from "../controllers/positionController";
import authenticate from "../middleware/auth";

const positionRouter = express.Router();

// Todas las rutas requieren autenticación
positionRouter.use(authenticate);

positionRouter.post("/", positionController.createPosition);
positionRouter.get("/open", positionController.getOpenPositions);
positionRouter.get("/closed", positionController.getClosedPositions);
positionRouter.post("/:id/close", positionController.closePosition);
positionRouter.put("/:id/price", positionController.updatePositionPrice);

export default positionRouter;