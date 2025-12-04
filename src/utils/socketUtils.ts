import { Server } from "socket.io";
import Order from "../model/orderModel";
import Position from "../model/positionModel";

function n(v: any, d = 0) { const x = Number(v); return Number.isFinite(x) ? x : d; }
const r2 = (x: number) => Number(x.toFixed(2));

async function calculateBalanceForMode(userId: string, isDemoMode: boolean) {
  const queryFilter = isDemoMode ? { isDemo: true } : { isDemo: { $ne: true } };

  const capitalOrders = await Order.find({ clientId: userId, isCapital: true, ...queryFilter }).lean();
  let depositos = 0, retiros = 0;
  for (const o of capitalOrders) {
    const actions = Array.isArray(o.operationActions) ? o.operationActions : [];
    const val = actions.reduce((acc, a) => acc + n(a.benefit) * n(a.quantity), 0);
    if (o.isWithdrawl) retiros += val; else depositos += val;
  }

  const tradeOrders = await Order.find({ clientId: userId, isCapital: false, operationStatus: "Finalizado", ...queryFilter }).lean();
  const pnlRealizado = tradeOrders.reduce((acc, o) => acc + n(o.operationValue), 0);

  const openPositions = await Position.find({ userId, status: "open", ...queryFilter }).lean();
  let costoAbierto = 0, pnlAbierto = 0;
  for (const p of openPositions) {
    const vol = n(p.volume);
    const open = n(p.openPrice);
    const cur = n(p.currentPrice, open);
    costoAbierto += vol * open;
    if (p.type === "Compra") pnlAbierto += (cur - open) * vol;
    else pnlAbierto += (open - cur) * vol;
  }

  const totalCapitalNeto = depositos - retiros + pnlRealizado;
  const capitalDisponible = totalCapitalNeto - costoAbierto;
  const equity = totalCapitalNeto + pnlAbierto;

  return {
    balance: r2(equity),
    capital: r2(capitalDisponible),
    ganancias: r2(pnlRealizado),
    margen: r2(pnlAbierto),
    margenReservado: r2(costoAbierto),
    capitalLibre: r2(capitalDisponible),
    puedeOperar: capitalDisponible > 0,
  };
}

export const emitBalanceUpdate = async (io: Server, userId: string) => {
  if (!io) return; // Protección
  try {
    const [real, demo] = await Promise.all([
      calculateBalanceForMode(userId, false),
      calculateBalanceForMode(userId, true)
    ]);
    
    io.to(userId).emit("balance_update", { real, demo });
    // console.log(`📡 Balance actualizado para ${userId}`);
  } catch (error) {
    console.error("Error socket balance:", error);
  }
};