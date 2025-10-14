import mongoose, { Document, Schema, Types } from "mongoose";

export type DocType = "banco" | "domicilio" | "id" | "otros";
export type DocStatus = "none" | "pending" | "verified";
export type GlobalOverride = "none" | "force_verified" | "force_unverified";
export type GlobalStatus = "verified" | "not_verified";

export interface IDocumentSlot {
  status: DocStatus;
  fileUrl: string | null;     // Ruta servible, p.ej. /uploads/archivo.pdf
  fileName: string | null;    // Nombre legible para UI
  fileSize: number | null;    // En bytes (para UI)
  fileType: string | null;    // MIME (image/png, application/pdf, etc.)
  updatedAt: Date | null;
}

export interface IUserVerification extends Document {
  userId: string | Types.ObjectId; // ID de User
  email: string;                   // redundante para lista admin rápida
  nombre: string;                  // idem
  // 4 documentos, con los mismos IDs que usa el frontend
  documents: {
    banco: IDocumentSlot;
    domicilio: IDocumentSlot;
    id: IDocumentSlot;
    otros: IDocumentSlot;
  };
  global: {
    status: GlobalStatus;        // derivado (o por override)
    override: GlobalOverride;    // control manual admin
    updatedAt: Date | null;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

const documentSlotSchema = new Schema<IDocumentSlot>(
  {
    status: { type: String, enum: ["none", "pending", "verified"], required: true, default: "none" },
    fileUrl: { type: String, default: null },
    fileName: { type: String, default: null },
    fileSize: { type: Number, default: null },
    fileType: { type: String, default: null },
    updatedAt: { type: Date, default: null },
  },
  { _id: false }
);

const userVerificationSchema = new Schema<IUserVerification>(
  {
    userId: {
      type: Schema.Types.Mixed,  // permitimos string u ObjectId para no romper integraciones
      required: true,
      index: true,
    },
    email: { type: String, required: true, index: true, trim: true },
    nombre: { type: String, required: true, trim: true },
    documents: {
      banco: { type: documentSlotSchema, required: true, default: () => ({}) },
      domicilio: { type: documentSlotSchema, required: true, default: () => ({}) },
      id: { type: documentSlotSchema, required: true, default: () => ({}) },
      otros: { type: documentSlotSchema, required: true, default: () => ({}) },
    },
    global: {
      status: { type: String, enum: ["verified", "not_verified"], required: true, default: "not_verified" },
      override: { type: String, enum: ["none", "force_verified", "force_unverified"], required: true, default: "none" },
      updatedAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  }
);

// Un usuario solo debe tener un registro de verificación
userVerificationSchema.index({ userId: 1 }, { unique: true });

const UserVerification = mongoose.model<IUserVerification>(
  "UserVerification",
  userVerificationSchema,
  "userverifications"
);

export default UserVerification;