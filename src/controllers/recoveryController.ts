import { Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcrypt";
import User from "../model/userModel";
import { sendRecoveryEmail } from "../utils/emailSender";
// 1. IMPORTAMOS EL SERVICIO DE CACHÉ
import { purgeUserCache } from "../controllers/services/userService";

// 1. Solicitar recuperación
export const requestReset = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      res.status(200).json({ ok: true, message: "Si el correo existe, se enviará el enlace." });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = Date.now() + 3600000;

    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();

    const emailSent = await sendRecoveryEmail(email, resetToken);

    if (emailSent) {
      res.status(200).json({ ok: true, message: "Correo enviado con éxito." });
    } else {
      res.status(500).json({ ok: false, message: "Error al enviar el correo." });
    }

  } catch (error) {
    console.error("Error requestReset:", error);
    res.status(500).json({ ok: false, message: "Error interno del servidor." });
  }
};

// 2. Ejecutar cambio
export const performReset = async (req: Request, res: Response): Promise<void> => {
  const { token, newPassword } = req.body;

  try {
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() }
    });

    if (!user) {
      res.status(400).json({ ok: false, message: "El enlace es inválido o ha expirado." });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Actualizar datos
    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    
    // Guardar cambios en BD
    await user.save();

    // 2. IMPORTANTE: Limpiar el caché de Redis para este usuario
    // Así el Login se verá obligado a leer la nueva contraseña de la BD
    try {
        await purgeUserCache({ email: user.email, id: String(user._id) });
    } catch (cacheError) {
        console.error("Error limpiando caché post-reset:", cacheError);
        // No detenemos el flujo si falla el caché, pero lo logueamos
    }

    res.status(200).json({ ok: true, message: "Contraseña actualizada correctamente." });

  } catch (error) {
    console.error("Error performReset:", error);
    res.status(500).json({ ok: false, message: "Error al cambiar contraseña." });
  }
};