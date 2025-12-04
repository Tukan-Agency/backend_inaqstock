import mongoose from "mongoose";

type CounterDoc = {
  _id: string; // nombre del contador, ej. "user_sequence"
  seq: number; // último valor asignado
};

const CounterSchema = new mongoose.Schema<CounterDoc>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 10000 },
  },
  { collection: "counters", versionKey: false }
);

export default mongoose.model<CounterDoc>("Counter", CounterSchema);