import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import Order from "../model/orderModel";
import Position from "../model/positionModel";
import History from "../model/historyModel";
import { getNextOperationNumber } from "../controllers/services/operationNumberService";
import { emitBalanceUpdate } from "../utils/socketUtils"; // ✅ Importamos el helper de socket

interface AuthenticatedRequest extends Request {
  user?: JwtPayload & { id: string; email?: string; name?: string };
}

// Recargar saldo Demo
export const resetDemoFunds = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const { amount } = req.body;
    const amountNum = Number(amount);

    if (!amountNum || amountNum <= 0) {
      res.status(400).json({ message: "Monto inválido" });
      return;
    }

    const opNum = await getNextOperationNumber();

    const demoOrder = new Order({
      clientId: req.user.id,
      operationNumber: opNum,
      operationDate: new Date(),
      operationStatus: "Finalizado",
      operationValue: amountNum,
      isCapital: true,
      isWithdrawl: false,
      isDemo: true, // Flag Demo
      operationActions: [{
        name: "Recarga Demo",
        quantity: 1,
        benefit: amountNum
      }]
    });

    await demoOrder.save();

    // ✅ SOCKET: Emitir actualización de balance al usuario
    const io = req.app.get("socketio");
    await emitBalanceUpdate(io, req.user.id);

    res.status(200).json({ success: true, message: "Saldo demo recargado" });

  } catch (error: any) {
    console.error("Error resetDemoFunds:", error);
    res.status(500).json({ message: "Error al recargar demo", error: error.message });
  }
};

// Borrar todos los datos Demo (Reset total)
export const clearDemoData = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const userId = req.user.id;

    // Borramos todo lo que tenga isDemo: true
    await Promise.all([
      Order.deleteMany({ clientId: userId, isDemo: true }),
      Position.deleteMany({ userId: userId, isDemo: true }),
      History.deleteMany({ clientId: userId, isDemo: true })
    ]);

    // ✅ SOCKET: Emitir actualización (los saldos demo volverán a 0)
    const io = req.app.get("socketio");
    await emitBalanceUpdate(io, userId);

    res.status(200).json({ success: true, message: "Cuenta demo reiniciada" });
  } catch (error: any) {
    console.error("Error clearDemoData:", error);
    res.status(500).json({ message: "Error reiniciando demo", error: error.message });
  }
};