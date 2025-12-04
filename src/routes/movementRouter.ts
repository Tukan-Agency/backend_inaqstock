import { Router } from "express";
import {
  crearMovimiento,
  obtenerMovimientos,
  obtenerMovimientosPaquete,
  obtenerMovimientosCliente,
  deleteMovement,
  actualizarEstado,
  actualizarEstadoPorRequestId,
} from "../controllers/movementController";

const router = Router();

router.post("/new", crearMovimiento);
router.get("/all", obtenerMovimientos);
router.get("/paquete", obtenerMovimientosPaquete);

// Ruta correcta actual
router.get("/client", obtenerMovimientosCliente);

// Alias legacy para evitar 404 si algún cliente usa /clientId
router.get("/clientId", obtenerMovimientosCliente);

router.delete("/delete", deleteMovement);
router.post("/update/status", actualizarEstado);
router.post("/update/status-by-requestId", actualizarEstadoPorRequestId);

export default router;