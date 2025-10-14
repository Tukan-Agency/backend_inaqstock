import mongoose, { Schema, Document } from "mongoose";

export interface IVerifyRequest extends Document {
  email: string;
  nombre: string;
  cuentaId: string;
  tipoDocumento: string;
  cuenta_verify: boolean;
  archivoUrl: string;
  fechaCreacion: Date;
}

const verifyRequestSchema = new Schema<IVerifyRequest>(
  {
    email: {
      type: String,
      required: true,
      trim: true,
    },
    nombre: {
      type: String,
      required: true,
      trim: true,
    },
    cuentaId: {
      type: String,
      required: true,
    },
    tipoDocumento: {
      type: String,
      required: true,
      enum: ["id", "domicilio", "banco", "otros"],
    },
    cuenta_verify: {
      type: Boolean,
      default: false,
    },
    archivoUrl: {
      type: String,
      required: true,
    },
    fechaCreacion: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export default mongoose.model<IVerifyRequest>(
  "VerifyRequest",
  verifyRequestSchema,
  "verifyrequest" // nombre de la colección en MongoDB
);
