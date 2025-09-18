// src/model/orderModel.ts
import mongoose, { Document, Schema } from "mongoose";

interface IOperationAction {
  name: string;
  quantity: number;
  benefit: number;
  _id?: mongoose.Types.ObjectId;
}

export interface IOrder extends Document {
  clientId: string; // ID del usuario autenticado
  operationActions: IOperationAction[];
  operationStatus: string;
  operationNumber: number;
  operationDate: Date;
  operationValue: number;
  isCapital: boolean;
  isWithdrawl: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const operationActionSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  benefit: {
    type: Number,
    required: true
  }
});

const orderSchema = new Schema<IOrder>(
  {
    clientId: {
      type: String,
      required: true,
      index: true // Para consultas rápidas por usuario
    },
    operationActions: [operationActionSchema],
    operationStatus: {
      type: String,
      required: true,
      enum: ['Finalizado', 'Pendiente', 'Cancelado']
    },
    operationNumber: {
      type: Number,
      required: true,
      unique: true
    },
    operationDate: {
      type: Date,
      required: true
    },
    operationValue: {
      type: Number,
      required: true,
      default: 0
    },
    isCapital: {
      type: Boolean,
      default: false
    },
    isWithdrawl: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IOrder>("Order", orderSchema);