import type { Request, Response } from "express";

type CryptoPoint = {
  symbol: string;  // "X:BTCUSD"
  price: number;
  ts: number;
  source: "polygon" | "fallback";
};

const lastCryptoPrice = new Map<string, CryptoPoint>();

function parseCryptoSymbol(raw?: string): { ok: boolean; base?: string; symbol?: string } {
  if (!raw) return { ok: false };
  const s = String(raw).trim().toUpperCase();
  const m = s.match(/^X:([A-Z0-9]+)USD$/);
  if (!m) return { ok: false };
  return { ok: true, base: m[1], symbol: s };
}

// Bases realistas por símbolo para fallback (NO se usa si Polygon responde)
const realisticBase: Record<string, number> = {
  BTC: 100000,
  ETH: 3500,
  SOL: 150,
  XRP: 0.6,
  ADA: 0.6,
  LTC: 70,
  DOGE: 0.15,
  BNB: 600,
};

function fallbackNext(symbol: string, base: string): CryptoPoint {
  const prev = lastCryptoPrice.get(symbol);
  const start =
    prev?.price ??
    realisticBase[base] ??
    // número pseudoaleatorio pero estable por base
    (1000 + (hash(base) % 90000));
  // pequeño random-walk +/- 0.1%
  const delta = (Math.random() - 0.5) * (start * 0.002);
  const price = Math.max(0.0001, start + delta);
  const point: CryptoPoint = {
    symbol,
    price: Number(price.toFixed(price < 2 ? 4 : 2)),
    ts: Date.now(),
    source: "fallback",
  };
  lastCryptoPrice.set(symbol, point);
  return point;
}

function hash(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return h >>> 0;
}

async function fetchPolygonCryptoLastTrade(symbolX: string, base: string, apiKey: string): Promise<CryptoPoint | null> {
  // Polygon REST: /v2/last/trade/crypto/<BASE>/USD
  const url = `https://api.polygon.io/v2/last/trade/crypto/${encodeURIComponent(base)}/USD?apiKey=${encodeURIComponent(apiKey)}`;

  // Timeout de 2500ms
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 2500);
  try {
    const res = await fetch(url, { signal: ctrl.signal as any });
    if (!res.ok) return null;
    const json: any = await res.json();

    // Campos posibles según plan/respuesta
    const p =
      Number(json?.results?.p) ??
      Number(json?.result?.price) ??
      Number(json?.price);

    if (!Number.isFinite(p)) return null;

    const ts =
      Number(json?.results?.t) ??
      Number(json?.result?.timestamp) ??
      Date.now();

    const point: CryptoPoint = {
      symbol: symbolX,
      price: Number(p),
      ts: Number.isFinite(ts) ? ts : Date.now(),
      source: "polygon",
    };
    lastCryptoPrice.set(symbolX, point);
    return point;
  } catch {
    return null;
  } finally {
    clearTimeout(to);
  }
}

// GET /api/prices/crypto/last?symbol=X:BTCUSD
export async function getCryptoLastPrice(req: Request, res: Response) {
  const { ok, base, symbol } = parseCryptoSymbol(String(req.query.symbol || ""));
  if (!ok || !base || !symbol) {
    res.status(400).json({ ok: false, message: "Símbolo inválido. Ejemplo: X:BTCUSD" });
    return;
  }

  const apiKey = process.env.POLYGON_API_KEY || process.env.VITE_POLYGON_API_KEY || "";
  try {
    let point: CryptoPoint | null = null;
    if (apiKey) {
      point = await fetchPolygonCryptoLastTrade(symbol, base, apiKey);
    }
    if (!point) {
      point = fallbackNext(symbol, base);
    }
    res.json({ ok: true, data: point });
  } catch (e: any) {
    const point = fallbackNext(symbol, base);
    res.status(200).json({ ok: true, data: point, warning: e?.message || "fallback" });
  }
}

// SSE /api/prices/crypto/stream?symbol=X:BTCUSD (1s)
export async function streamCryptoPriceSSE(req: Request, res: Response) {
  const { ok, base, symbol } = parseCryptoSymbol(String(req.query.symbol || ""));
  if (!ok || !base || !symbol) {
    res.status(400).json({ ok: false, message: "Símbolo inválido. Ejemplo: X:BTCUSD" });
    return;
  }

  const apiKey = process.env.POLYGON_API_KEY || process.env.VITE_POLYGON_API_KEY || "";

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  let alive = true;
  req.on("close", () => { alive = false; });

  // Enviar primero
  (async () => {
    const first =
      (apiKey ? await fetchPolygonCryptoLastTrade(symbol, base, apiKey) : null) ||
      fallbackNext(symbol, base);
    try { res.write(`data: ${JSON.stringify({ type: "price", ...first })}\n\n`); } catch {}
  })();

  const id = setInterval(async () => {
    if (!alive) {
      clearInterval(id);
      return;
    }
    try {
      const point =
        (apiKey ? await fetchPolygonCryptoLastTrade(symbol, base, apiKey) : null) ||
        fallbackNext(symbol, base);
      res.write(`data: ${JSON.stringify({ type: "price", ...point })}\n\n`);
    } catch {
      const point = fallbackNext(symbol, base);
      try {
        res.write(`data: ${JSON.stringify({ type: "price", ...point })}\n\n`);
      } catch {
        clearInterval(id);
      }
    }
  }, 1000);
}