import express from "express";
import * as authController from "../controllers/authController"; // ✅ Correcto
import authenticate from "../middleware/auth";

const authRouter = express.Router();

authRouter.post("/login", authController.login);
authRouter.post("/check-email", authController.checkEmail);
authRouter.delete("/logout", authController.logout);
authRouter.get("/session", authenticate, authController.getSession);
authRouter.post("/register", authController.addUser);


export default authRouter;
