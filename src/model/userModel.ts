import mongoose, { Document, Schema } from "mongoose";

interface ICountry {
  name: string;
  code: string;
  flag: string;
}

interface ICurrency {
  name: string;
}

interface IPackage {
  packageId: string;
  packageName: string;
}

export interface IUser extends Document {
  name: string;
  surname: string;
  birthday: Date;
  email: string;
  username: string;
  password: string;
  address: string;
  company: string;
  contactNumber: number;
  whatsapp: number;
  country: ICountry;
  currency: ICurrency;
  role: number;
  package: IPackage;
  sequenceId: number;
  cuenta_verify: boolean; // ✅ nuevo campo
  verifiedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    surname: { type: String, required: true },
    birthday: { type: Date, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    address: { type: String, required: true },
    company: { type: String, required: true },
    contactNumber: { type: Number, required: true },
    whatsapp: { type: Number, required: true },
    country: {
      name: { type: String, required: true },
      code: { type: String, required: true },
      flag: { type: String, required: true },
    },
    currency: {
      name: { type: String, required: true },
    },
    role: { type: Number, required: true },
    package: {
      packageId: { type: String, required: true },
      packageName: { type: String, required: true },
    },
    sequenceId: { type: Number, required: true, unique: true },

    // ✅ Campo nuevo
    cuenta_verify: { type: Boolean, default: false },

  },
  {
    timestamps: true,
  }
);

const User = mongoose.model<IUser>("User", userSchema);

export default User;
