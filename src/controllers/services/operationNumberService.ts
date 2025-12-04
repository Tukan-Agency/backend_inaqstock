import Order from "../../model/orderModel";

/**
 * Devuelve el siguiente operationNumber incremental.
 * Si no hay órdenes existentes, empieza en 1001.
 * NOTA: Este método es suficiente para carga baja/media.
 * (Si tuvieras muchísimas escrituras simultáneas y choques de índice único,
 * podrías migrar luego a un contador atómico.)
 */
export async function getNextOperationNumber(baseSeed = 1000): Promise<number> {
  const latest = await Order.findOne({})
    .sort({ operationNumber: -1 })
    .select({ operationNumber: 1 })
    .lean()
    .exec();

  const currentMax =
    typeof latest?.operationNumber === "number" && Number.isFinite(latest.operationNumber)
      ? latest.operationNumber
      : baseSeed;

  return currentMax + 1;
}