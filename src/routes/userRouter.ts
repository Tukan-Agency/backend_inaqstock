import { Router } from "express";
import { updateMe, changeMyPassword, checkEmailAvailability, toggleCuentaVerifyUser} from "../controllers/userController";

const router = Router();

router.put("/me", updateMe);
router.post("/me/password", changeMyPassword);
router.post("/check-email", checkEmailAvailability);
router.put("/:id/toggle-verify", toggleCuentaVerifyUser);

export default router;