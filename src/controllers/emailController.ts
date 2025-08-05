import bcrypt from "bcrypt";
import dotenv from "dotenv";
import sendEmail from "../config/email/email";
import renderHtml from "../config/email/template";
import UserOtp from "../model/userOtp";
import User from "../model/userModel";

dotenv.config();

export function codeGenerator(): number {
  return Math.floor(1000 + Math.random() * 9000);
}

export async function sendEmailVerify(user_id: string): Promise<boolean> {
  try {
    const code = codeGenerator();
    const hashedOtp = await bcrypt.hash(code.toString(), 10);
    const newUser = await User.findOne({ _id: user_id });

    if (!newUser) {
      throw new Error("User not found");
    }

    await UserOtp.create({
      user_id: newUser._id,
      otp: hashedOtp,
      expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hora de expiración
    });

    const from = process.env.EMAIL_FROM;
    if (!from) throw new Error("EMAIL_FROM not defined in environment");

    const to = newUser.email;
    const subject = "Welcome to Auth App 💻";
    const text = "Verify your account"; // opcional, pero útil
    const username = newUser.username;
    const html = await renderHtml(code, username, from);

    console.log("Verification code:", code);

   // await sendEmail({ to, from, subject,  html });
    return true;
  } catch (e) {
    console.error("Failed to send verification email:", e);
    return false;
  }
}
