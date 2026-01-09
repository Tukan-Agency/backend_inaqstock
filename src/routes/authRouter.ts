import express from "express";
import * as authController from "../controllers/authController"; 
import * as recoveryController from "../controllers/recoveryController"; // ✅ Importamos el nuevo controlador
import authenticate from "../middleware/auth";

const authRouter = express.Router();

// Rutas existentes
authRouter.post("/login", authController.login);
authRouter.get("/get-sequence-ids", authController.getSequenceIds);
authRouter.post("/check-email", authController.checkEmail);
authRouter.delete("/logout", authController.logout);
authRouter.get("/session", authenticate, authController.getSession);
authRouter.post("/register", authController.addUser);
authRouter.get("/sequence/peek", authController.peekSequence);

// ✅ Nuevas rutas de recuperación
authRouter.post("/forgot-password", recoveryController.requestReset);
authRouter.post("/reset-password", recoveryController.performReset);

export default authRouter;