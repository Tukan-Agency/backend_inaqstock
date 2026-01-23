import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { sendVerificationEmail } from "../utils/emailSender";
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

    // Guardar el OTP en la base de datos
    await UserOtp.create({
      user_id: newUser._id,
      otp: hashedOtp,
      expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hora de expiración
    });

    console.log("Verification code:", code);

    // Enviar email usando el nuevo servicio SMTP
    const emailSent = await sendVerificationEmail(
      newUser.email,
      newUser.username,
      code
    );

    if (!emailSent) {
      throw new Error("Failed to send verification email");
    }

    return true;
  } catch (e) {
    console.error("Failed to send verification email:", e);
    return false;
  }
}

// Opcional: Función para probar la conexión SMTP
export const testEmailService = async () => {
  try {
    const { testSMTPConnection } = await import("../utils/emailSender");
    const isConnected = await testSMTPConnection();
    return { success: isConnected };
  } catch (error) {
    console.error("Error testing email service:", error);
    
    // CORRECCIÓN: Hacer type assertion para acceder a message
    if (error instanceof Error) {
      return { success: false, error: error.message };
    } else {
      return { success: false, error: String(error) };
    }
  }
};