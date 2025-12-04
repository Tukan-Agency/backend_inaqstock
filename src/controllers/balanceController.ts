import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import Order from "../model/orderModel";
import Position from "../model/positionModel";

interface AuthenticatedRequest extends Request {
  user?: JwtPayload & { id: string };
}

function n(v: any, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}
const r2 = (x: number) => Number(x.toFixed(2));

/**
 * Helper para calcular balances.
 * CORRECCIÓN CRÍTICA: Para 'Real', buscamos documentos donde isDemo NO sea true
 * (esto incluye false y undefined/null para soportar datos legacy).
 */
async function calculateBalanceForMode(userId: string, isDemoMode: boolean) {
  // Si buscamos Demo, debe ser true. Si buscamos Real, cualquier cosa que NO sea true.
  const queryFilter = isDemoMode ? { isDemo: true } : { isDemo: { $ne: true } };

  // 1) Capital base
  const capitalOrders = await Order.find({ 
    clientId: userId, 
    isCapital: true, 
    ...queryFilter 
  }).lean();

  let depositos = 0;
  let retiros = 0;
  for (const o of capitalOrders) {
    const actions = Array.isArray(o.operationActions) ? o.operationActions : [];
    const totalActions = actions.reduce((acc, a) => acc + n(a.benefit) * n(a.quantity), 0);
    if (o.isWithdrawl) retiros += totalActions;
    else depositos += totalActions;
  }

  // 2) PnL realizado
  const tradeOrders = await Order.find({
    clientId: userId,
    isCapital: false,
    operationStatus: "Finalizado",
    ...queryFilter
  }).lean();
  const pnlRealizado = tradeOrders.reduce((acc, o) => acc + n(o.operationValue), 0);

  // 3) Posiciones abiertas
  const openPositions = await Position.find({ 
    userId, 
    status: "open", 
    ...queryFilter
  }).lean();

  let costoAbierto = 0;
  let pnlAbierto = 0;
  for (const p of openPositions) {
    const vol = n(p.volume);
    const open = n(p.openPrice);
    const cur = n(p.currentPrice, open);
    costoAbierto += vol * open;
    if (p.type === "Compra") pnlAbierto += (cur - open) * vol;
    else pnlAbierto += (open - cur) * vol;
  }

  // 4) Totales
  const totalCapitalNeto = depositos - retiros + pnlRealizado;
  const capitalDisponible = totalCapitalNeto - costoAbierto;
  const equity = totalCapitalNeto + pnlAbierto;
  const margen = pnlAbierto;
  const ganancias = pnlRealizado;

  return {
    balance: r2(equity),
    capital: r2(capitalDisponible),
    ganancias: r2(ganancias),
    margen: r2(margen),
    margenReservado: r2(costoAbierto),
    capitalLibre: r2(capitalDisponible),
    puedeOperar: capitalDisponible > 0,
    depositos: r2(depositos),
    retiros: r2(retiros)
  };
}

export const getUserBalances = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "No autorizado" });
      return;
    }
    const userId = req.user.id;

    const [real, demo] = await Promise.all([
      calculateBalanceForMode(userId, false),
      calculateBalanceForMode(userId, true)
    ]);

    res.status(200).json({
      success: true,
      data: {
        real,
        demo,
        ...real // Fallback para compatibilidad
      },
    });
  } catch (error: any) {
    console.error("Error calculating balances:", error);
    res.status(500).json({
      success: false,
      message: "Error al calcular balances",
      error: error.message,
    });
  }
};

export const getBalancePreferences = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: { preferences: ["balance"] } });
};

export const updateBalancePreferences = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  res.status(200).json({ success: true, message: "OK" });
};