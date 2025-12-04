import mongoose, { Document, Schema } from "mongoose";

export type RequestStatus = "Creado" | "En proceso" | "Finalizado" | "Rechazado";
export type RequestType = "Retiro" | "Deposito";

export interface IRequest extends Document {
  clientId: string;
  clientName: string;
  ibanAccount?: string;
  bankName: string;
  numberAccount?: number;      // ← igual que el legacy (Number en Mongo)
  requestedValue: number;
  requestStatus: RequestStatus;
  requestDate: Date;
  requestType: RequestType;
  createdAt?: Date;
  updatedAt?: Date;
}

const requestSchema = new Schema<IRequest>(
  {
    clientId: { type: String, required: true, index: true },
    clientName: { type: String, required: true },
    ibanAccount: { type: String },
    bankName: { type: String, required: true },
    numberAccount: { type: Number }, // ← igual que antes; no es required (legacy tenía el require comentado)
    requestedValue: { type: Number, required: true },
    requestStatus: {
      type: String,
      required: true,
      enum: ["Creado", "En proceso", "Finalizado", "Rechazado"],
    },
    requestDate: { type: Date, required: true },
    requestType: {
      type: String,
      required: true,
      enum: ["Retiro", "Deposito"],
    },
  },
  { timestamps: true }
);

export default mongoose.model<IRequest>("Request", requestSchema);