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

// Si tienes middlewares de authenticate / requireAdmin, puedes colocarlos en las rutas /admin
// import authenticate from "../middleware/auth";
// import requireAdmin from "../middleware/requireAdmin";

const router = Router();

// Self
router.put("/me", updateMe);
router.post("/me/password", changeMyPassword);
router.post("/check-email", checkEmailAvailability);
router.put("/:id/toggle-verify", toggleCuentaVerifyUser);

// Admin (puedes proteger con authenticate, requireAdmin)
router.get("/admin", /*authenticate, requireAdmin,*/ getAllUsersAdmin);
router.put("/admin/:id", /*authenticate, requireAdmin,*/ updateUserAdmin);
router.delete("/admin/:id", /*authenticate, requireAdmin,*/ deleteUserAdmin);

export default router;