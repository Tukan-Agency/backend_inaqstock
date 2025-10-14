import { RequestHandler } from "express";
import User from "../model/userModel";
import type { AuthenticatedRequest } from "./auth";

/**
 * Middleware de autorización para rol admin (role === 1).
 * Tipado como RequestHandler para que encaje con Express sin errores de overload.
 */
const requireAdmin: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const aReq = req as AuthenticatedRequest;

    if (!aReq.user?.id) {
      res.status(401).json({ message: "No autenticado" });
      return;
    }

    const user = await User.findById(aReq.user.id).select("role");
    if (!user || user.role !== 1) {
      res.status(403).json({ message: "No autorizado" });
      return;
    }

    next();
  } catch (e: any) {
    res.status(500).json({ message: "Error de autorización", error: e?.message });
    return;
  }
};

export default requireAdmin;