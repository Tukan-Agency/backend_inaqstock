import { Request, Response } from "express";
import VerifyRequest from "../model/verifyRequestModel";

// 📤 Controlador para crear una nueva solicitud de verificación
export const createVerifyRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tipoDocumento, email, nombre, cuentaId, cuenta_verify } = req.body;

    if (!req.file) {
      res.status(400).json({ error: "Debe adjuntar un archivo." });
      return;
    }

    const archivoUrl = `/uploads/${req.file.filename}`;

    const nuevaSolicitud = new VerifyRequest({
      tipoDocumento,
      email,
      nombre,
      cuentaId,
      cuenta_verify,
      archivoUrl,
    });

    await nuevaSolicitud.save();

    res.status(201).json({
      message: "Solicitud de verificación creada correctamente.",
      data: nuevaSolicitud,
    });
  } catch (error: any) {
    console.error("❌ Error en createVerifyRequest:", error);
    res.status(500).json({
      error: "Error al procesar la solicitud de verificación.",
      details: error.message,
    });
  }
};

// 📥 Controlador para obtener todas las solicitudes de verificación
export const getAllVerifyRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const solicitudes = await VerifyRequest.find().sort({ createdAt: -1 });
    res.status(200).json(solicitudes);
  } catch (error: any) {
    console.error("❌ Error al obtener solicitudes:", error);
    res.status(500).json({
      error: "Error al obtener las solicitudes de verificación.",
      details: error.message,
    });
  }
};

// 🔄 Controlador para alternar el estado de verificación (true/false)
export const toggleCuentaVerify = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Buscar la solicitud por su ID
    const solicitud = await VerifyRequest.findById(id);
    if (!solicitud) {
      res.status(404).json({ error: "Solicitud no encontrada" });
      return;
    }

    // Alternar el estado actual
    solicitud.cuenta_verify = !solicitud.cuenta_verify;
    await solicitud.save();

    res.status(200).json({
      message: solicitud.cuenta_verify
        ? "Cuenta marcada como verificada."
        : "Cuenta marcada como no verificada.",
      cuenta_verify: solicitud.cuenta_verify,
    });
  } catch (error: any) {
    console.error("❌ Error al actualizar cuenta_verify:", error);
    res.status(500).json({
      error: "Error al actualizar el estado de verificación.",
      details: error.message,
    });
  }
};
