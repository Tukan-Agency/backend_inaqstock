import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt, { type Secret, type JwtPayload } from "jsonwebtoken";
import { Types } from "mongoose";
import User from "../model/userModel";

// FIX Tipos: garantiza que el secreto JWT sea de tipo Secret (no string | undefined)
const JWT_SECRET: Secret = (() => {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET not defined in environment variables.");
  return s;
})();

// Helpers locales (sin tocar otros archivos)
function getTokenFromReq(req: Request): string | undefined {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.split(" ")[1]
    : undefined;
  return req.cookies?.token || bearer;
}

function getUserIdFromReq(req: Request): string | null {
  const token = getTokenFromReq(req);
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return (decoded as any)?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * POST /api/users/check-email
 * Body: { email: string }
 * Respuesta: { exists: boolean, available: boolean, message: string }
 * - Si el email corresponde al del propio usuario autenticado, se devuelve available=true (no se considera conflicto).
 */
export async function checkEmailAvailability(req: Request, res: Response): Promise<void> {
  try {
    const raw = req.body?.email ?? req.query?.email;
    const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
    if (!email) {
      res.status(400).json({ exists: false, available: false, message: "Correo no válido" });
      return;
    }

    const currentUserId = getUserIdFromReq(req);

    // ¿Existe algún usuario (distinto del actual) con ese correo?
    const existing = await User.findOne({ email }).select("_id email");
    const exists = !!existing && String(existing._id) !== String(currentUserId || "");

    res.status(200).json({
      exists,
      available: !exists,
      message: exists ? "Este correo ya está registrado" : "Correo disponible",
    });
  } catch (e: any) {
    res.status(500).json({ exists: false, available: false, message: e.message || "Error al verificar el correo" });
  }
}

/**
 * PUT /api/users/me
 * Body (parcial): {
 *   name?: string,
 *   surname?: string,
 *   email?: string,
 *   address?: string,
 *   contactNumber?: number | string,
 *   whatsapp?: number | string,
 *   country?: { name?: string, code?: string, flag?: string }
 * }
 */
export async function updateMe(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) {
      res.status(401).json({ message: "No autenticado" });
      return;
    }

    // Cargamos el usuario para comparar email y evitar duplicados
    const current = await User.findById(userId).select("_id email");
    if (!current) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }

    const {
      name,
      surname,
      email: rawEmail,
      address,
      contactNumber,
      whatsapp,
      country,
    } = req.body || {};

    // Normalización y validación de email único
    let emailToSet: string | undefined = undefined;
    if (typeof rawEmail === "string") {
      const email = rawEmail.trim().toLowerCase();
      if (email && email !== current.email) {
        const exists = await User.findOne({ email }).select("_id email");
        if (exists && String(exists._id) !== String(userId)) {
          res.status(409).json({ message: "Este correo ya está registrado" });
          return;
        }
        emailToSet = email;
      }
    }

    // Construir $set solo con campos válidos
    const $set: Record<string, any> = {};
    if (typeof name === "string") $set.name = name;
    if (typeof surname === "string") $set.surname = surname;
    if (typeof address === "string") $set.address = address;
    if (emailToSet !== undefined) $set.email = emailToSet;

    if (contactNumber !== undefined) {
      const n = Number(contactNumber);
      if (!Number.isNaN(n)) $set.contactNumber = n;
    }

    if (whatsapp !== undefined) {
      const n = Number(whatsapp);
      if (!Number.isNaN(n)) $set.whatsapp = n;
    }

    if (country && typeof country === "object") {
      $set["country.name"] = country.name;
      $set["country.code"] = country.code;
      $set["country.flag"] = country.flag;
    }

    // Actualización parcial: valida solo los paths modificados
    const updated = await User.findByIdAndUpdate(
      userId,
      { $set },
      {
        new: true,
        runValidators: true,
        context: "query",
      }
    ).select("_id");

    if (!updated) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }

    res.status(200).json({
      message: "Perfil actualizado",
      id: (updated._id as Types.ObjectId).toString(),
    });
  } catch (e: any) {
    // Si quieres mapear errores de validación:
    if (e?.name === "ValidationError") {
      res.status(400).json({ message: "Validación fallida", errors: e.errors });
      return;
    }
    res.status(500).json({ message: "Error al actualizar perfil", error: e.message });
    console.log(e);
  }
}

/**
 * POST /api/users/me/password
 * Body: { newPassword: string }
 */
export async function changeMyPassword(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) {
      res.status(401).json({ message: "No autenticado" });
      return;
    }

    const { newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 6) {
      res
        .status(400)
        .json({ message: "La contraseña debe tener al menos 6 caracteres" });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }

    user.password = await bcrypt.hash(String(newPassword), 10);
    await user.save();

    res.status(200).json({ message: "Contraseña actualizada" });
  } catch (e: any) {
    res.status(500).json({ message: "Error al cambiar contraseña", error: e.message });
  }
}