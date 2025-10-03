import { RequestHandler } from "express";
import Order from "../model/orderModel";
import History from "../model/historyModel"; // Para borrar el movimiento vinculado en delete

// POST /api/orders/new
// Nota: el old recibía req.body.orden. Permitimos ambos: body.orden o body directo.
export const crearOrden: RequestHandler = async (req, res, next) => {
  try {
    const payload = req.body?.orden ?? req.body;

    // Validación mínima
    if (!payload || !payload.clientId || payload.operationNumber == null) {
      res.status(400).json({ ok: false, msg: "Payload inválido" });
      return;
    }

    const dbOrder = new Order(payload);
    await dbOrder.save();

    res.status(201).json({
      ok: true,
      uid: dbOrder.id,
      operationNumber: dbOrder.operationNumber,
    });
  } catch (error: any) {
    // Manejo de unique operationNumber
    if (error?.code === 11000) {
      res.status(409).json({ ok: false, msg: "operationNumber duplicado" });
      return;
    }
    next(error);
  }
};

// GET /api/orders/all
export const obtenerOrdenes: RequestHandler = async (_req, res, next) => {
  try {
    const ordenes = await Order.find({}).lean();
    res.json({ ok: true, ordenes });
  } catch (error) {
    next(error);
  }
};

// GET /api/orders/client
// Old: toma x-clientId en header
export const obtenerOrdenesBycLient: RequestHandler = async (req, res, next) => {
  try {
    const clientId = req.header("x-clientId");
    if (!clientId) {
      res.status(400).json({ ok: false, msg: "x-clientId requerido" });
      return;
    }
    const ordenes = await Order.find({ clientId }).lean();
    res.json({ ok: true, ordenes });
  } catch (error) {
    next(error);
  }
};

// PUT /api/orders/update
// Old: actualiza operationActions y opcionalmente operationDate
export const UpdateOrder: RequestHandler = async (req, res, next) => {
  try {
    const orderUpdate = req.body;
    if (!orderUpdate?._id) {
      res.status(400).json({ ok: false, msg: "_id requerido" });
      return;
    }

    const valuesToUpdate: Record<string, any> = {};
    if (Array.isArray(orderUpdate.operationActions)) {
      valuesToUpdate.operationActions = orderUpdate.operationActions;
    }
    if (orderUpdate.operationDate) {
      valuesToUpdate.operationDate = new Date(orderUpdate.operationDate);
    }

    await Order.findByIdAndUpdate(orderUpdate._id, valuesToUpdate);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

// POST /api/orders/update/status
// Old: actualiza operationStatus
export const actualizarEstado: RequestHandler = async (req, res, next) => {
  try {
    const orderUpdate = req.body;
    if (!orderUpdate?._id || typeof orderUpdate?.status !== "string") {
      res.status(400).json({ ok: false, msg: "Campos inválidos" });
      return;
    }

    await Order.findByIdAndUpdate(orderUpdate._id, {
      operationStatus: orderUpdate.status,
    });

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

// POST /api/orders/update/status/end
// Old: actualiza operationStatus, operationValue y operationActions
export const actualizarEstadoFinalizado: RequestHandler = async (req, res, next) => {
  try {
    const orderUpdate = req.body;
    if (!orderUpdate?._id || typeof orderUpdate?.status !== "string") {
      res.status(400).json({ ok: false, msg: "Campos inválidos" });
      return;
    }

    const updateDoc: Record<string, any> = {
      operationStatus: orderUpdate.status,
    };

    if (typeof orderUpdate.operationValue === "number") {
      updateDoc.operationValue = orderUpdate.operationValue;
    }
    if (Array.isArray(orderUpdate.operationActions)) {
      updateDoc.operationActions = orderUpdate.operationActions;
    }

    await Order.findByIdAndUpdate(orderUpdate._id, updateDoc);

    res.status(200).json({ ok: true, status: 200 });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/orders/delete/:ID
// Old: elimina la orden y borra 1 movimiento con requestId = ID
export const deleteOrder: RequestHandler = async (req, res, next) => {
  try {
    const { ID } = req.params;
    if (!ID) {
      res.status(400).json({ ok: false, msg: "ID requerido" });
      return;
    }

    await Order.findByIdAndDelete(ID);
    await History.findOneAndDelete({ requestId: ID });

    // Si además tienes un Request model y quieres replicar el old completamente,
    // también podrías borrar la Request con ese ID.

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};