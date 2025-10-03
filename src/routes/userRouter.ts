import { Router } from "express";
import { updateMe, changeMyPassword, checkEmailAvailability } from "../controllers/userController";

const router = Router();

router.put("/me", updateMe);
router.post("/me/password", changeMyPassword);
router.post("/check-email", checkEmailAvailability);


export default router;