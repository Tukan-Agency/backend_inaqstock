import mongoose, { Document, Schema } from "mongoose";

export interface IHistory extends Document {
  clientId: string;
  requestId: string;
  clientName: string;
  type: string;         // "Deposito" | "Retiro" | "Paquete" | etc.
  requestDate: Date;
  status: string;
  value: string;        // en old era string; mantenemos compat
  createdAt?: Date;
  updatedAt?: Date;
}

const historySchema = new Schema<IHistory>(
  {
    clientId: { type: String, required: true, index: true },
    requestId: { type: String, required: true },
    clientName: { type: String, required: true },
    type: { type: String, required: true },
    requestDate: { type: Date, required: true },
    status: { type: String, required: true },
    value: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IHistory>("History", historySchema);