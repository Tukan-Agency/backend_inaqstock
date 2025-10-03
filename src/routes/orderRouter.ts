import { Router } from "express";
import {
  crearOrden,
  obtenerOrdenes,
  obtenerOrdenesBycLient,
  actualizarEstadoFinalizado,
  actualizarEstado,
  UpdateOrder,
  deleteOrder,
} from "../controllers/orderController";

// Si quieres proteger con auth, añade tu middleware:
// import authenticate from "../middleware/auth";

const router = Router();

router.get("/all", /*authenticate,*/ obtenerOrdenes);
router.get("/client", /*authenticate,|*/ obtenerOrdenesBycLient);
router.put("/update", /*authenticate,*/ UpdateOrder);
router.post("/new", /*authenticate,*/ crearOrden);
router.post("/update/status", /*authenticate,*/ actualizarEstado);
router.post("/update/status/end", /*authenticate,*/ actualizarEstadoFinalizado);
router.delete("/delete/:ID", /*authenticate,*/ deleteOrder);

export default router;