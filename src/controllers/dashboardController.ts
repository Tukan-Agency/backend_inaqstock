import { RequestHandler } from "express";
import RequestModel from "../model/requestModel";
import History from "../model/historyModel";
import User from "../model/userModel";

// Utilidades de fecha
function atStart(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function atEnd(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function parseRange(query: any): { from?: Date; to?: Date } {
  // Soporta ?from=YYYY-MM-DD&to=YYYY-MM-DD o ?range=today|7d|30d|90d|year|all
  const now = new Date();
  const fromQ = query?.from ? new Date(query.from) : null;
  const toQ = query?.to ? new Date(query.to) : null;

  if (fromQ && !isNaN(fromQ.getTime()) && toQ && !isNaN(toQ.getTime())) {
    return { from: atStart(fromQ), to: atEnd(toQ) };
  }

  const r = String(query?.range || "30d").toLowerCase();
  switch (r) {
    case "today": {
      return { from: atStart(now), to: atEnd(now) };
    }
    case "7d": {
      const from = new Date(now);
      from.setDate(now.getDate() - 6);
      return { from: atStart(from), to: atEnd(now) };
    }
    case "30d": {
      const from = new Date(now);
      from.setDate(now.getDate() - 29);
      return { from: atStart(from), to: atEnd(now) };
    }
    case "90d": {
      const from = new Date(now);
      from.setDate(now.getDate() - 89);
      return { from: atStart(from), to: atEnd(now) };
    }
    case "year": {
      const from = new Date(now.getFullYear(), 0, 1);
      return { from: atStart(from), to: atEnd(now) };
    }
    case "all":
    default:
      return {};
  }
}

function dateMatch(field: string, range: { from?: Date; to?: Date }) {
  if (!range.from && !range.to) return {};
  if (range.from && range.to) return { [field]: { $gte: range.from, $lte: range.to } };
  if (range.from) return { [field]: { $gte: range.from } };
  return { [field]: { $lte: range.to! } };
}

function flagFromCodeMaybe(code?: string | null) {
  if (!code) return null;
  const cc = String(code).toLowerCase();
  if (/^[a-z]{2}$/.test(cc)) {
    return `https://flagcdn.com/w20/${cc}.png`;
  }
  return null;
}

/**
 * GET /api/dashboard/overview
 * Query opcional:
 *   - range=today|7d|30d|90d|year|all (default 30d) o from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Respuesta:
 * {
 *   ok: true,
 *   totalUsers, totalRequests, totalMovements,
 *   countries: [{ name, code, flag, users }]
 * }
 */
export const getOverview: RequestHandler = async (req, res, next) => {
  try {
    const range = parseRange(req.query);

    // Filtros por fecha aplican a Requests y Movements; Users no (es total global)
    const requestMatch = dateMatch("requestDate", range);
    const movementMatch = dateMatch("requestDate", range);

    const [totalUsers, totalRequests, totalMovements, topCountries] = await Promise.all([
      User.countDocuments({}),
      RequestModel.countDocuments(requestMatch),
      History.countDocuments(movementMatch),
      // Agrupar usuarios por país
      User.aggregate([
        {
          $group: {
            _id: {
              name: "$country.name",
              code: "$country.code",
              flag: "$country.flag",
            },
            users: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            name: "$_id.name",
            code: "$_id.code",
            // si no hay flag guardado, generamos uno por code (si es ISO-2)
            flag: {
              $cond: [
                { $ifNull: ["$_id.flag", false] },
                "$_id.flag",
                null,
              ],
            },
            users: 1,
          },
        },
        { $sort: { users: -1 } },
        { $limit: 50 },
      ]),
    ]);

    const countries = (topCountries || []).map((c: any) => ({
      name: c?.name || "N/D",
      code: c?.code || "",
      flag: c?.flag || flagFromCodeMaybe(c?.code) || "",
      users: Number(c?.users || 0),
    }));

    res.json({
      ok: true,
      totalUsers,
      totalRequests,
      totalMovements,
      countries,
    });
  } catch (error) {
    next(error);
  }
};