import { Router } from "express";
import { resetDemoFunds, clearDemoData } from "../controllers/demoController";
// Ajusta la importación según como exportes tu middleware (default o named)
import verifyToken from "../middleware/auth"; 

const demoRouter = Router();

// POST para sumar dinero
demoRouter.post("/reset", verifyToken, resetDemoFunds);

// ✅ DELETE para borrar todo (Botón Reset)
demoRouter.delete("/reset", verifyToken, clearDemoData);

export default demoRouter;