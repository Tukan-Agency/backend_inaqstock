import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import User from "../model/userModel";
import UserVerification, {
  IUserVerification,
  DocType,
  DocStatus,
} from "../model/userVerificationModel";
import { AuthenticatedRequest } from "../middleware/auth";

// Tipos y helpers
const ALLOWED_DOCS: DocType[] = ["banco", "domicilio", "id", "otros"];

function isDocType(v: string): v is DocType {
  return ALLOWED_DOCS.includes(v as DocType);
}

function allDocsVerified(uv: IUserVerification): boolean {
  const d = uv.documents;
  return (
    d.banco.status === "verified" &&
    d.domicilio.status === "verified" &&
    d.id.status === "verified" &&
    d.otros.status === "verified"
  );
}

async function computeAndSyncGlobal(uv: IUserVerification): Promise<void> {
  // Derivar estado global según override o estado real
  let nextVerified: boolean;
  if (uv.global.override === "force_verified") nextVerified = true;
  else if (uv.global.override === "force_unverified") nextVerified = false;
  else nextVerified = allDocsVerified(uv);

  uv.global.status = nextVerified ? "verified" : "not_verified";
  uv.global.updatedAt = new Date();
  await uv.save();

  // Sincronizar bandera rápida en User
  try {
    await User.findByIdAndUpdate(
      uv.userId,
      { $set: { cuenta_verify: nextVerified } },
      { new: false }
    );
  } catch {
    // no romper si falla
  }
}

async function ensureUserVerification(payload: {
  userId: string;
  email: string;
  nombre: string;
}): Promise<IUserVerification> {
  const found = await UserVerification.findOne({ userId: payload.userId });
  if (found) return found;

  const created = await UserVerification.create({
    userId: payload.userId,
    email: payload.email,
    nombre: payload.nombre,
    documents: {
      banco: { status: "none", fileUrl: null, fileName: null, fileSize: null, fileType: null, updatedAt: null },
      domicilio: { status: "none", fileUrl: null, fileName: null, fileSize: null, fileType: null, updatedAt: null },
      id: { status: "none", fileUrl: null, fileName: null, fileSize: null, fileType: null, updatedAt: null },
      otros: { status: "none", fileUrl: null, fileName: null, fileSize: null, fileType: null, updatedAt: null },
    },
    global: { status: "not_verified", override: "none", updatedAt: null },
  });

  return created;
}

// Ruta estática de uploads (debe coincidir con uploadMiddleware)
const uploadsDir = path.join(__dirname, "../uploads");

// ========== Rutas de Usuario ==========
export async function getMyVerification(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "No autenticado" });
      return;
    }

    // Cargar datos básicos de usuario para crear registro si no existe
    const user = await User.findById(req.user.id).select("name surname email");
    if (!user) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }

    const nombre = [user.name, user.surname].filter(Boolean).join(" ").trim() || "Usuario";
    const uv = await ensureUserVerification({
      userId: req.user.id,
      email: user.email,
      nombre,
    });

    res.status(200).json({ ok: true, data: uv });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || "Error" });
  }
}

export async function uploadMyDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "No autenticado" });
      return;
    }

    const docType = String(req.params.docType || "").trim();
    if (!isDocType(docType)) {
      res.status(400).json({ ok: false, message: "Tipo de documento inválido" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ ok: false, message: "Archivo requerido" });
      return;
    }

    const user = await User.findById(req.user.id).select("name surname email");
    if (!user) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }
    const nombre = [user.name, user.surname].filter(Boolean).join(" ").trim() || "Usuario";

    const uv = await ensureUserVerification({
      userId: req.user.id,
      email: user.email,
      nombre,
    });

    // Actualizar slot
    const fileUrl = `/uploads/${req.file.filename}`;
    const slot = uv.documents[docType];
    slot.status = "pending";
    slot.fileUrl = fileUrl;
    slot.fileName = req.file.originalname || req.file.filename;
    slot.fileSize = req.file.size;
    slot.fileType = req.file.mimetype;
    slot.updatedAt = new Date();

    await uv.save();
    await computeAndSyncGlobal(uv);

    res.status(200).json({ ok: true, data: uv });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || "Error" });
  }
}

// ========== Rutas de Admin ==========
export async function getAdminRequests(_req: Request, res: Response): Promise<void> {
  try {
    const list = await UserVerification.find({})
      .sort({ updatedAt: -1 })
      .select("userId email nombre documents global updatedAt createdAt")
      .lean();

    res.status(200).json({ ok: true, data: list });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || "Error" });
  }
}

export async function getUserVerification(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    const uv = await UserVerification.findOne({ userId });
    if (!uv) {
      res.status(404).json({ ok: false, message: "Registro de verificación no encontrado" });
      return;
    }
    res.status(200).json({ ok: true, data: uv });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || "Error" });
  }
}

export async function adminUploadDocument(req: Request, res: Response): Promise<void> {
  try {
    const { userId, docType: rawDoc } = req.params;
    const docType = String(rawDoc || "").trim();
    if (!isDocType(docType)) {
      res.status(400).json({ ok: false, message: "Tipo de documento inválido" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ ok: false, message: "Archivo requerido" });
      return;
    }

    const uv = await UserVerification.findOne({ userId });
    if (!uv) {
      res.status(404).json({ ok: false, message: "Registro de verificación no encontrado" });
      return;
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const slot = uv.documents[docType];
    slot.status = "pending";
    slot.fileUrl = fileUrl;
    slot.fileName = req.file.originalname || req.file.filename;
    slot.fileSize = req.file.size;
    slot.fileType = req.file.mimetype;
    slot.updatedAt = new Date();

    await uv.save();
    await computeAndSyncGlobal(uv);

    res.status(200).json({ ok: true, data: uv });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || "Error" });
  }
}

export async function approveDocument(req: Request, res: Response): Promise<void> {
  try {
    const { userId, docType: rawDoc } = req.params;
    const docType = String(rawDoc || "").trim();
    if (!isDocType(docType)) {
      res.status(400).json({ ok: false, message: "Tipo de documento inválido" });
      return;
    }

    const uv = await UserVerification.findOne({ userId });
    if (!uv) {
      res.status(404).json({ ok: false, message: "Registro de verificación no encontrado" });
      return;
    }

    const slot = uv.documents[docType];
    slot.status = "verified";
    slot.updatedAt = new Date();

    await uv.save();
    await computeAndSyncGlobal(uv);

    res.status(200).json({ ok: true, data: uv });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || "Error" });
  }
}

export async function rejectDocument(req: Request, res: Response): Promise<void> {
  try {
    const { userId, docType: rawDoc } = req.params;
    const docType = String(rawDoc || "").trim();
    if (!isDocType(docType)) {
      res.status(400).json({ ok: false, message: "Tipo de documento inválido" });
      return;
    }

    const uv = await UserVerification.findOne({ userId });
    if (!uv) {
      res.status(404).json({ ok: false, message: "Registro de verificación no encontrado" });
      return;
    }

    // Si hay archivo, intentamos eliminarlo del FS (opcional, best-effort)
    const currentUrl = uv.documents[docType].fileUrl;
    if (currentUrl) {
      try {
        const filename = path.basename(currentUrl);
        const abs = path.join(uploadsDir, filename);
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      } catch {
        // Ignorar
      }
    }

    uv.documents[docType] = {
      status: "none",
      fileUrl: null,
      fileName: null,
      fileSize: null,
      fileType: null,
      updatedAt: new Date(),
    };

    await uv.save();
    await computeAndSyncGlobal(uv);

    res.status(200).json({ ok: true, data: uv });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || "Error" });
  }
}

export async function setGlobalVerification(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    const { verified } = req.body as { verified?: boolean | null };

    const uv = await UserVerification.findOne({ userId });
    if (!uv) {
      res.status(404).json({ ok: false, message: "Registro de verificación no encontrado" });
      return;
    }

    if (verified === true) {
      uv.global.override = "force_verified";
    } else if (verified === false) {
      uv.global.override = "force_unverified";
    } else {
      uv.global.override = "none";
    }

    await computeAndSyncGlobal(uv);
    res.status(200).json({ ok: true, data: uv });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || "Error" });
  }
}