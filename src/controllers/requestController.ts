import { RequestHandler } from "express";
import RequestModel, { IRequest, RequestStatus } from "../model/requestModel";

const ALLOWED_STATUS: RequestStatus[] = ["Creado", "En proceso", "Finalizado", "Rechazado"];

// Escapa caracteres especiales de regex
function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Búsqueda flexible por tokens
function buildSearchFilter(qRaw: string) {
  const q = (qRaw || "").trim();
  if (!q) return {};

  const tokens = q
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => new RegExp(escapeRegex(t), "i"));

  if (!tokens.length) return {};

  const perTokenOr = (rx: RegExp) => ({
    $or: [
      { clientName: rx },
      { bankName: rx },
      { requestType: rx },
      { ibanAccount: rx },
    ],
  });

  return {
    $and: tokens.map(perTokenOr),
  };
}

// POST /api/admin/requests/new (sin cambios)
export const createRequest: RequestHandler = async (req, res, next) => {
  try {
    const payload = req.body?.request ?? req.body ?? {};
    delete payload?._id;
    delete payload?.id;

    if (
      !payload?.clientId ||
      !payload?.clientName ||
      !payload?.bankName ||
      payload?.requestedValue == null ||
      !payload?.requestStatus ||
      !payload?.requestDate ||
      !payload?.requestType
    ) {
      res.status(400).json({ ok: false, msg: "Payload inválido" });
      return;
    }

    const doc = new RequestModel(payload as Partial<IRequest>);
    await doc.save();

    res.status(201).json({ ok: true, uid: doc.id });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/requests/all → ahora añade numberAccountText
export const getAllRequests: RequestHandler = async (req, res, next) => {
  try {
    const page = req.query.page ? Math.max(1, Number(req.query.page)) : 0; // 0 = sin paginar (legacy)
    const perPageRaw = Number(req.query.perPage) || 100;
    const perPage = Math.min(Math.max(1, perPageRaw), 500);
    const status = (req.query.status as string) || "";
    const q = (req.query.q as string) || "";

    const filter: Record<string, any> = {};
    if (status && ALLOWED_STATUS.includes(status as RequestStatus)) {
      filter.requestStatus = status;
    }
    if (q) {
      Object.assign(filter, buildSearchFilter(q));
    }

    const baseQuery = RequestModel.find(filter)
      .select(
        "clientName requestType ibanAccount bankName numberAccount requestedValue requestDate requestStatus"
      )
      .sort({ requestDate: -1 });

    let docs: any[];
    let total = 0;

    if (page > 0) {
      total = await RequestModel.countDocuments(filter);
      docs = await baseQuery.skip((page - 1) * perPage).limit(perPage).lean();
    } else {
      docs = await baseQuery.lean();
      total = docs.length;
    }

    // Serializar numberAccount a texto seguro
    const requests = (docs || []).map((d) => {
      let numberAccountText = "";
      const v = (d as any).numberAccount;
      if (v !== null && v !== undefined) {
        if (typeof v === "string" || typeof v === "number") {
          numberAccountText = String(v);
        } else if (typeof v?.toString === "function") {
          const s = v.toString();
          numberAccountText = s === "[object Object]" ? "" : s;
        }
      }
      return { ...d, numberAccountText };
    });

    res.json({
      ok: true,
      requests,
      page: page || undefined,
      perPage: page ? perPage : undefined,
      total,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/requests/update/status (sin cambios)
export const updateRequestStatus: RequestHandler = async (req, res, next) => {
  try {
    const id = req.body?._id as string | undefined;
    const status = req.body?.status as RequestStatus | undefined;

    if (!id || !status || !ALLOWED_STATUS.includes(status)) {
      res.status(400).json({ ok: false, msg: "Campos inválidos" });
      return;
    }

    await RequestModel.findByIdAndUpdate(id, { requestStatus: status });

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};