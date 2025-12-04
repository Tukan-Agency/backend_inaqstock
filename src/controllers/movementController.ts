import { RequestHandler } from "express";
import History from "../model/historyModel";
// Si usas estos modelos, descomenta e importa sus versiones TS.
// import RequestModel from "../model/requestModel";
import Order from "../model/orderModel";

export const crearMovimiento: RequestHandler = async (req, res, next) => {
  try {
    let movimiento: any = null;

    if (req.body.type === "Paquete") {
      movimiento = await History.findOne({ clientId: req.body.clientId });
    }

    if (movimiento) {
      await History.findOneAndUpdate(
        { clientId: movimiento.clientId },
        {
          clientName: req.body.clientName,
          requestDate: req.body.requestDate,
          requestId: req.body.requestId,
          status: req.body.status,
          value: req.body.value,
        }
      );
      res.status(200).json({ ok: true, status: 200 });
      return;
    }

    const dbMovimiento = new History(req.body);
    await dbMovimiento.save();
    res.status(201).json({ ok: true, status: 200 });
  } catch (error) {
    next(error);
  }
};

export const obtenerMovimientos: RequestHandler = async (_req, res, next) => {
  try {
    const movimientos = await History.find({});
    res.json({ ok: true, movimientos });
  } catch (error) {
    next(error);
  }
};

export const obtenerMovimientosPaquete: RequestHandler = async (_req, res, next) => {
  try {
    const movimientos = await History.find({ type: "Paquete" });
    res.json({ ok: true, movimientos });
  } catch (error) {
    next(error);
  }
};

// UPDATE: Ahora soporta ?mode=demo o ?mode=real
export const obtenerMovimientosCliente: RequestHandler = async (req, res, next) => {
  try {
    const clientId = req.header("x-clientId");
    const mode = req.query.mode as string; // Leemos el modo

    if (!clientId) {
      res.status(400).json({ ok: false, msg: "x-clientId requerido" });
      return;
    }

    // Filtro dinámico
    const queryFilter: any = { clientId };

    if (mode === "demo") {
      queryFilter.isDemo = true;
    } else {
      // Para modo Real, traemos lo que NO sea true
      queryFilter.isDemo = { $ne: true };
    }

    const movimientos = await History.find(queryFilter);
    res.json({ ok: true, movimientos });
  } catch (error) {
    next(error);
  }
};

export const deleteMovement: RequestHandler = async (req, res, next) => {
  try {
    const requestId = req.header("x-requestId");
    const movementId = req.header("x-movementId");

    if (!movementId) {
      res.status(400).json({ ok: false, msg: "x-movementId requerido" });
      return;
    }

    await History.findByIdAndDelete(movementId);

    // Si quieres replicar el comportamiento old, descomenta si tienes estos modelos en TS
    // if (requestId) {
    //   await RequestModel.findByIdAndDelete(requestId);
    //   await Order.findByIdAndDelete(requestId);
    // }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

export const actualizarEstado: RequestHandler = async (req, res, next) => {
  try {
    const { _id, status } = req.body || {};
    if (!_id || typeof status !== "string") {
      res.status(400).json({ ok: false, msg: "Campos inválidos" });
      return;
    }

    await History.findByIdAndUpdate(_id, { status });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

// NUEVO: actualizar estado de movimientos por requestId (para usarlo desde Admin tras cambiar una solicitud)
export const actualizarEstadoPorRequestId: RequestHandler = async (req, res, next) => {
  try {
    const requestId = req.body?.requestId as string | undefined;
    const status = req.body?.status as string | undefined;

    if (!requestId || typeof status !== "string") {
      res.status(400).json({ ok: false, msg: "Campos inválidos" });
      return;
    }

    const upd = await History.updateMany({ requestId }, { status });
    res.json({
      ok: true,
      matched: (upd as any)?.matchedCount ?? (upd as any)?.matched ?? 0,
    });
  } catch (error) {
    next(error);
  }
};