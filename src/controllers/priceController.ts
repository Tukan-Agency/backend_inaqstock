import type { Request, Response } from "express";

type PricePoint = {
  symbol: string;
  price: number;
  ts: number;
  source: "polygon";
};

const lastPriceMap = new Map<string, PricePoint>();

function isValidSymbol(symbol?: string): symbol is string {
  if (!symbol) return false;
  // Permitir : para crypto (ej: X:BTCUSD) y . para stocks (ej: BRK.B)
  return /^[A-Z0-9\.\:]{1,20}$/.test(symbol);
}

async function fetchPolygonPrice(symbol: string): Promise<PricePoint | null> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) throw new Error("POLYGON_API_KEY not set");

  const isCrypto = symbol.includes(":");
  let url: string;
  if (isCrypto) {
    // Crypto: last trade
    url = `https://api.polygon.io/v2/last/trade/${symbol}?apiKey=${apiKey}`;
  } else {
    // Stock: previous day aggregate (close price)
    url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?apiKey=${apiKey}`;
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Polygon API error: ${res.status}`);

  const data = await res.json();
  if (isCrypto) {
    if (!data.results || !data.results.p) return null;
    return {
      symbol,
      price: Number(data.results.p),
      ts: data.results.t,
      source: "polygon",
    };
  } else {
    if (!data.results || data.results.length === 0 || !data.results[0].c) return null;
    return {
      symbol,
      price: Number(data.results[0].c),
      ts: data.results[0].t,
      source: "polygon",
    };
  }
}

// GET /api/prices/last?symbol=AAPL o X:BTCUSD
export async function getLastPrice(req: Request, res: Response) {
  const symbol = String(req.query.symbol || "").trim().toUpperCase();
  if (!isValidSymbol(symbol)) {
    res.status(400).json({ ok: false, message: "Símbolo inválido. Ejemplo: AAPL o X:BTCUSD" });
    return;
  }

  try {
    const point = await fetchPolygonPrice(symbol);
    if (!point) {
      res.status(404).json({ ok: false, message: "No data from Polygon" });
      return;
    }
    lastPriceMap.set(symbol, point);
    res.json({ ok: true, data: point });
  } catch (e: any) {
    // Fallback to cached
    const cached = lastPriceMap.get(symbol);
    if (cached) {
      res.json({ ok: true, data: cached, warning: e?.message || "fallback cached" });
    } else {
      res.status(500).json({ ok: false, message: e?.message || "Error fetching price" });
    }
  }
}

// SSE /api/prices/stream?symbol=AAPL o X:BTCUSD
export async function streamLivePriceSSE(req: Request, res: Response) {
  const symbol = String(req.query.symbol || "").trim().toUpperCase();
  if (!isValidSymbol(symbol)) {
    res.status(400).json({ ok: false, message: "Símbolo inválido. Ejemplo: AAPL o X:BTCUSD" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  let alive = true;
  req.on("close", () => { alive = false; });

  // Enviar precio inicial
  const initial = await fetchPolygonPrice(symbol).catch(() => lastPriceMap.get(symbol));
  if (initial) {
    res.write(`data: ${JSON.stringify({ type: "price", ...initial })}\n\n`);
  }

  // Polling cada 10s para stocks (día no cambia rápido), 2s para crypto
  const interval = symbol.includes(":") ? 2000 : 10000;
  const id = setInterval(async () => {
    if (!alive) {
      clearInterval(id);
      return;
    }
    try {
      const p = await fetchPolygonPrice(symbol);
      if (p) {
        lastPriceMap.set(symbol, p);
        res.write(`data: ${JSON.stringify({ type: "price", ...p })}\n\n`);
      }
    } catch {
      // Mantener vivo sin error
    }
  }, interval);

  req.on("close", () => {
    clearInterval(id);
  });
}