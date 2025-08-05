import mongoose, { Document, Schema } from "mongoose";

export interface IUserOtp extends Document {
  user_id: string;
  otp: string;
  expiresAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const userOtpSchema = new Schema<IUserOtp>(
  {
    user_id: {
      type: String,
      required: true,
    },
    otp: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const UserOtp = mongoose.model<IUserOtp>("UserOtp", userOtpSchema);

export default UserOtp;
