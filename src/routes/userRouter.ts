import { Router } from "express";
import {
  updateMe,
  changeMyPassword,
  checkEmailAvailability,
  toggleCuentaVerifyUser,
  getAllUsersAdmin,
  updateUserAdmin,
  deleteUserAdmin
} from "../controllers/userController";
import authenticate from "../middleware/auth"; // <--- IMPORTANTE: Descomenta o agrega esto
// import requireAdmin from "../middleware/requireAdmin";

const router = Router();

// Self (Rutas protegidas para el usuario logueado)
router.put("/me", authenticate, updateMe); // <--- AGREGAR authenticate
router.post("/me/password", authenticate, changeMyPassword); // <--- AGREGAR authenticate
router.post("/check-email", checkEmailAvailability); // Esta puede ser pública
router.put("/:id/toggle-verify", authenticate, toggleCuentaVerifyUser); // <--- AGREGAR authenticate

// Admin
// router.get("/admin", authenticate, requireAdmin, getAllUsersAdmin);
// router.put("/admin/:id", authenticate, requireAdmin, updateUserAdmin);
// router.delete("/admin/:id", authenticate, requireAdmin, deleteUserAdmin);

// Mantenemos las de admin como las tenías si no quieres tocar esa parte aún,
// pero idealmente también deberían llevar 'authenticate'.
router.get("/admin", getAllUsersAdmin);
router.put("/admin/:id", updateUserAdmin);
router.delete("/admin/:id", deleteUserAdmin);

export default router;