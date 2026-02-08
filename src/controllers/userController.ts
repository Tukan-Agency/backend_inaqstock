import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt, { type Secret, type JwtPayload } from "jsonwebtoken";
import { Types } from "mongoose";
import User from "../model/userModel";
import { purgeUserCache } from "../controllers/services/userService"; 

// Interfaz para TS
interface AuthenticatedRequest extends Request {
  user?: JwtPayload & { id: string };
}

const JWT_SECRET: Secret = (() => {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET not defined in environment variables.");
  return s;
})();

// HELPER: RENOVAR SESIÓN
const refreshUserSession = (res: Response, user: any) => {
  const tokenPayload = {
    id: String(user._id),
    email: user.email,
    username: user.username,
    surname: user.surname,
  };

  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "8h" }); 

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 60 * 60 * 1000, 
  });

  return token;
};

// Helper legacy (lo mantenemos por si acaso se usa en otro lado)
function getTokenFromReq(req: Request): string | undefined {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.split(" ")[1]
    : undefined;
  return req.cookies?.token || bearer;
}

// Helper legacy
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

// --- FUNCIONES EXPORTADAS ---

export async function getAllUsersAdmin(_req: Request, res: Response): Promise<void> {
  try {
    const users = await User.find({}).lean();
    res.status(200).json({ ok: true, users });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e.message || "Error" });
  }
}

export async function updateUserAdmin(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const {
      name, surname, email, address, company, contactNumber, whatsapp,
      birthday, country, currency, newPassword,
    } = req.body || {};

    let $set: Record<string, any> = {};
    if (typeof name === "string") $set.name = name;
    if (typeof surname === "string") $set.surname = surname;
    if (typeof address === "string") $set.address = address;
    if (typeof company === "string") $set.company = company;

    if (email) {
      const emailN = String(email).trim().toLowerCase();
      const existing = await User.findOne({ email: emailN }).select("_id email");
      if (existing && String(existing._id) !== String(id)) {
        res.status(409).json({ ok: false, message: "Este correo ya está registrado" });
        return;
      }
      $set.email = emailN;
    }

    if (contactNumber !== undefined) $set.contactNumber = Number(contactNumber) || 0;
    if (whatsapp !== undefined) $set.whatsapp = Number(whatsapp) || 0;
    if (birthday) $set.birthday = new Date(birthday);
    
    if (country && typeof country === "object") {
      $set["country.name"] = country.name;
      $set["country.code"] = country.code;
      $set["country.flag"] = country.flag;
    }
    if (currency && typeof currency === "object") {
      const cname = currency.name ?? currency.code ?? currency;
      if (cname) $set["currency.name"] = cname;
    }

    if (newPassword && String(newPassword).length >= 6) {
      $set.password = await bcrypt.hash(String(newPassword), 10);
    }

    const updated = await User.findByIdAndUpdate(
      id,
      { $set },
      { new: true, runValidators: true, context: "query" }
    ).select("_id email");

    if (!updated) {
      res.status(404).json({ ok: false, message: "Usuario no encontrado" });
      return;
    }

    await purgeUserCache({ id, email: updated.email }).catch(() => {});
    res.status(200).json({ ok: true, id: (updated._id as Types.ObjectId).toString() });
  } catch (e: any) {
    if (e?.name === "ValidationError") {
      res.status(400).json({ ok: false, message: "Validación fallida", errors: e.errors });
      return;
    }
    res.status(500).json({ ok: false, message: e.message || "Error" });
  }
}

export async function deleteUserAdmin(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const deleted = await User.findByIdAndDelete(id).select("email");
    if (!deleted) {
      res.status(404).json({ ok: false, message: "Usuario no encontrado" });
      return;
    }
    await purgeUserCache({ id, email: deleted.email }).catch(() => {});
    res.status(200).json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e.message || "Error" });
  }
}

export async function checkEmailAvailability(req: Request, res: Response): Promise<void> {
  try {
    const raw = req.body?.email ?? req.query?.email;
    const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
    if (!email) {
      res.status(400).json({ exists: false, available: false, message: "Correo no válido" });
      return;
    }
    const currentUserId = getUserIdFromReq(req);
    const existing = await User.findOne({ email }).select("_id email");
    const exists = !!existing && String(existing._id) !== String(currentUserId || "");

    res.status(200).json({
      exists,
      available: !exists,
      message: exists ? "Este correo ya está registrado" : "Correo disponible",
    });
  } catch (e: any) {
    res.status(500).json({ exists: false, available: false, message: e.message || "Error" });
  }
}

/**
 * PUT /api/users/me
 */
export async function updateMe(req: Request, res: Response): Promise<void> {
  try {
    // 1. OBTENER USUARIO DEL MIDDLEWARE
    const userPayload = (req as AuthenticatedRequest).user;
    
    if (!userPayload || !userPayload.id) {
      res.status(401).json({ message: "No autenticado" });
      return;
    }
    const userId = userPayload.id;

    const current = await User.findById(userId).select("_id email");
    if (!current) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }

    const {
      name, surname, email: rawEmail, address, contactNumber, whatsapp, country,
    } = req.body || {};

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

    const $set: Record<string, any> = {};
    if (typeof name === "string") $set.name = name;
    if (typeof surname === "string") $set.surname = surname;
    if (typeof address === "string") $set.address = address;
    if (emailToSet !== undefined) $set.email = emailToSet;
    if (contactNumber !== undefined) $set.contactNumber = Number(contactNumber) || 0;
    if (whatsapp !== undefined) $set.whatsapp = Number(whatsapp) || 0;
    if (country && typeof country === "object") {
      $set["country.name"] = country.name;
      $set["country.code"] = country.code;
      $set["country.flag"] = country.flag;
    }

    const updated = await User.findByIdAndUpdate(
      userId,
      { $set },
      { new: true, runValidators: true, context: "query" }
    );

    if (!updated) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }

    await purgeUserCache({ id: userId, email: current.email }).catch(() => {});

    // 2. REFRESCAR SESIÓN
    const token = refreshUserSession(res, updated);

    res.status(200).json({
      message: "Perfil actualizado",
      id: (updated._id as Types.ObjectId).toString(),
      token, 
      user: updated
    });
  } catch (e: any) {
    if (e?.name === "ValidationError") {
      res.status(400).json({ message: "Validación fallida", errors: e.errors });
      return;
    }
    res.status(500).json({ message: "Error al actualizar perfil", error: e.message });
  }
}

/**
 * POST /api/users/me/password
 */
export async function changeMyPassword(req: Request, res: Response): Promise<void> {
  try {
    const userPayload = (req as AuthenticatedRequest).user;
    if (!userPayload || !userPayload.id) {
      res.status(401).json({ message: "No autenticado" });
      return;
    }
    const userId = userPayload.id;

    const { newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 6) {
      res.status(400).json({ message: "La contraseña debe tener al menos 6 caracteres" });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }

    user.password = await bcrypt.hash(String(newPassword), 10);
    const updatedUser = await user.save();

    await purgeUserCache({ id: userId, email: user.email }).catch(() => {});
    const token = refreshUserSession(res, updatedUser);

    res.status(200).json({ message: "Contraseña actualizada", token });
  } catch (e: any) {
    res.status(500).json({ message: "Error al cambiar contraseña", error: e.message });
  }
}

export const toggleCuentaVerifyUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado." });
      return;
    }
    const nuevoEstado = !user.cuenta_verify;
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { cuenta_verify: nuevoEstado },
      { new: true, runValidators: false }
    );
    res.status(200).json({
      message: nuevoEstado ? "Cuenta verificada." : "Verificación removida.",
      cuenta_verify: updatedUser?.cuenta_verify,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Error interno", details: error.message });
  }
};