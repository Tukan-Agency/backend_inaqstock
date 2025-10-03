import { Router } from "express";
import {
  crearMovimiento,
  obtenerMovimientos,
  obtenerMovimientosPaquete,
  actualizarEstado,
  obtenerMovimientosCliente,
  deleteMovement,
} from "../controllers/movementController";

// Si quieres proteger con auth, importa tu middleware y añádelo.
// import authenticate from "../middleware/auth";

const router = Router();

router.post("/new", /*authenticate,*/ crearMovimiento);
router.get("/all", /*authenticate,*/ obtenerMovimientos);
router.get("/package", /*authenticate,*/ obtenerMovimientosPaquete);
router.post("/update/status", /*authenticate,*/ actualizarEstado);
router.get("/clientId", /*authenticate,*/ obtenerMovimientosCliente);
router.delete("/delete", /*authenticate,*/ deleteMovement);

export default router;
