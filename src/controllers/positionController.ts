import { Request, Response } from "express";
import Position from "../model/positionModel";
import Order from "../model/orderModel";
import History from "../model/historyModel";
import { JwtPayload } from "jsonwebtoken";
import { getNextOperationNumber } from "../controllers/services/operationNumberService";
import { emitBalanceUpdate } from "../utils/socketUtils"; // ✅ Importamos el helper de socket

interface AuthenticatedRequest extends Request {
  user?: JwtPayload & { id: string; email?: string; name?: string };
}

function num(v: any, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

// Helper interno para validar capital antes de operar
async function getCapitalAvailable(userId: string, isDemoMode: boolean) {
  // Si es demo buscamos isDemo: true. Si es Real, isDemo: { $ne: true } (incluye legacy)
  const queryFilter = isDemoMode ? { isDemo: true } : { isDemo: { $ne: true } };

  // 1. Capital base
  const capitalOrders = await Order.find({ clientId: userId, isCapital: true, ...queryFilter }).lean();
  let totalCapital = 0;
  for (const o of capitalOrders) {
    const acts = Array.isArray(o.operationActions) ? o.operationActions : [];
    const val = acts.reduce((acc, a) => acc + num(a.benefit) * num(a.quantity), 0);
    if (o.isWithdrawl) totalCapital -= val; else totalCapital += val;
  }

  // 2. PnL Realizado
  const tradeOrders = await Order.find({ clientId: userId, isCapital: false, operationStatus: "Finalizado", ...queryFilter }).lean();
  const pnlRealizado = tradeOrders.reduce((acc, o) => acc + num(o.operationValue), 0);

  // 3. Costo posiciones abiertas
  const openPos = await Position.find({ userId, status: "open", ...queryFilter }).lean();
  let costoAbierto = 0;
  for (const p of openPos) {
    costoAbierto += num(p.volume) * num(p.openPrice);
  }

  return (totalCapital + pnlRealizado) - costoAbierto;
}

export const createPosition = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const { symbol, volume, type, openPrice, mode } = req.body;
    const vol = num(volume);
    const price = num(openPrice);
    const isDemo = mode === 'demo'; // Detectar modo

    if (!symbol || vol <= 0 || price <= 0 || (type !== "Compra" && type !== "Venta")) {
      res.status(400).json({ message: "Datos inválidos" });
      return;
    }

    // Validar capital
    const capitalDisponible = await getCapitalAvailable(req.user.id, isDemo);
    const requiredCost = vol * price;

    if (capitalDisponible < requiredCost) {
      res.status(403).json({
        message: `Capital ${isDemo ? 'Demo' : 'Real'} insuficiente`,
        capitalDisponible: Number(capitalDisponible.toFixed(2)),
        requiredCost: Number(requiredCost.toFixed(2)),
      });
      return;
    }

    const position = new Position({
      userId: req.user.id,
      symbol,
      volume: vol,
      type,
      openPrice: price,
      currentPrice: price,
      openTime: new Date(),
      status: "open",
      isDemo: isDemo // ✅ Guardamos flag demo
    });

    position.calculateProfit();
    await position.save();

    // ✅ SOCKET: Actualizar balances (el capital bajará por el margen reservado)
    const io = req.app.get("socketio");
    await emitBalanceUpdate(io, req.user.id);

    res.status(201).json(position);
  } catch (error: any) {
    res.status(500).json({ message: "Error al crear posición", error: error.message });
  }
};

export const closePosition = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const { id } = req.params;
    const { closePrice } = req.body;
    const priceClose = num(closePrice);

    const position = await Position.findOne({
      _id: id,
      userId: req.user.id,
      status: "open",
    });

    if (!position) {
      res.status(404).json({ message: "Posición no encontrada" });
      return;
    }

    if (priceClose <= 0) {
      res.status(400).json({ message: "Precio de cierre inválido" });
      return;
    }

    position.closePrice = priceClose;
    position.closeTime = new Date();
    position.status = "closed";
    position.calculateProfit();
    await position.save();

    const pnl = num(position.profit);
    const operationNumber = await getNextOperationNumber();

    // Crear Order para afectar balance
    const tradeOrder = new Order({
      clientId: req.user.id,
      operationNumber,
      operationDate: position.closeTime,
      operationStatus: "Finalizado",
      operationValue: pnl,
      isCapital: false,
      isWithdrawl: pnl < 0,
      isDemo: position.isDemo,
      symbol: position.symbol, // ✅ CORRECCIÓN: Guardamos el símbolo aquí
      operationActions: [],
    });
    await tradeOrder.save();

    // Crear Historial
    if (pnl !== 0) {
      const movement = new History({
        clientId: req.user.id,
        clientName: req.user.name || req.user.email || "",
        requestId: String(tradeOrder._id),
        type: pnl > 0 ? "Deposito" : "Retiro", 
        requestDate: position.closeTime,
        status: "Finalizado",
        value: String(Math.abs(pnl)),
        isDemo: position.isDemo
      });
      await movement.save();
    }

    // ✅ SOCKET: Actualizar balances (libera margen, suma/resta PnL)
    const io = req.app.get("socketio");
    await emitBalanceUpdate(io, req.user.id);

    res.status(200).json({ position, pnl });
  } catch (error: any) {
    res.status(500).json({ message: "Error al cerrar posición", error: error.message });
  }
};

export const getOpenPositions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }
    
    const isDemo = req.query.mode === 'demo';
    const queryFilter = isDemo ? { isDemo: true } : { isDemo: { $ne: true } };

    const positions = await Position.find({
      userId: req.user.id,
      status: "open",
      ...queryFilter
    }).sort({ openTime: -1 });

    res.status(200).json(positions);
  } catch (error: any) {
    res.status(500).json({ message: "Error al obtener posiciones", error: error.message });
  }
};

export const getClosedPositions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const isDemo = req.query.mode === 'demo';
    const queryFilter = isDemo ? { isDemo: true } : { isDemo: { $ne: true } };

    const positions = await Position.find({
      userId: req.user.id,
      status: "closed",
      ...queryFilter
    }).sort({ closeTime: -1 });

    res.status(200).json(positions);
  } catch (error: any) {
    res.status(500).json({ message: "Error al obtener posiciones", error: error.message });
  }
};

export const updatePositionPrice = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }
    const { id } = req.params;
    const { currentPrice } = req.body;
    const p = num(currentPrice);

    const position = await Position.findOne({ _id: id, userId: req.user.id, status: "open" });

    if (!position) {
      res.status(404).json({ message: "Posición no encontrada" });
      return;
    }

    if (p > 0) {
      position.currentPrice = p;
      position.calculateProfit();
      await position.save();
    }
    res.status(200).json(position);
  } catch (error: any) {
    res.status(500).json({ message: "Error", error: error.message });
  }
};