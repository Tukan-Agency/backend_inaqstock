import mongoose, { Document, Schema } from "mongoose";

// Definir una interfaz para los métodos
interface IPositionMethods {
  calculateProfit(): IPosition;
}

// Extender la interfaz Document con nuestros métodos personalizados
export interface IPosition extends Document, IPositionMethods {
  userId: string;
  symbol: string;
  type: 'Compra' | 'Venta';
  volume: number;
  openPrice: number;
  currentPrice: number;
  closePrice?: number;
  openTime: Date;
  closeTime?: Date;
  tp?: string;
  sl?: string;
  swap: number;
  commission: number;
  profit?: number;
  profitPercentage?: number;
  status: 'open' | 'closed';
}

// Crear un tipo para el modelo que incluya los métodos
type PositionModel = mongoose.Model<IPosition, {}, IPositionMethods>;

const positionSchema = new Schema<IPosition, PositionModel>(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    symbol: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['Compra', 'Venta'],
      required: true
    },
    volume: {
      type: Number,
      required: true
    },
    openPrice: {
      type: Number,
      required: true
    },
    currentPrice: {
      type: Number,
      required: true
    },
    closePrice: Number,
    openTime: {
      type: Date,
      required: true
    },
    closeTime: Date,
    tp: String,
    sl: String,
    swap: {
      type: Number,
      default: 0
    },
    commission: {
      type: Number,
      default: 0
    },
    profit: Number,
    profitPercentage: Number,
    status: {
      type: String,
      enum: ['open', 'closed'],
      required: true,
      default: 'open'
    }
  },
  {
    timestamps: true
  }
);

positionSchema.methods.calculateProfit = function() {
  const position = this as IPosition;
  const price = position.closePrice || position.currentPrice;
  const multiplier = position.type === 'Compra' ? 1 : -1;
  
  const rawProfit = (price - position.openPrice) * position.volume * multiplier;
  position.profit = parseFloat(rawProfit.toFixed(2));
  
  const rawPercentage = (rawProfit / (position.openPrice * position.volume)) * 100;
  position.profitPercentage = parseFloat(rawPercentage.toFixed(2));
  
  return position;
};

const Position = mongoose.model<IPosition, PositionModel>('Position', positionSchema);
export default Position;