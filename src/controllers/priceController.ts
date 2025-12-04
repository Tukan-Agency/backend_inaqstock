import type { Request, Response } from "express";

type PricePoint = {
  symbol: string;
  price: number;
  ts: number;
  source: "rest" | "stub";
};

const lastPriceMap = new Map<string, PricePoint>();

function isValidSymbol(symbol?: string): symbol is string {
  if (!symbol) return false;
  // Para stocks / options simple: letras y . (ej: BRK.B)
  return /^[A-Z0-9\.]{1,15}$/.test(symbol);
}

function nextStubPrice(symbol: string): PricePoint {
  const prev = lastPriceMap.get(symbol);
  const base = prev?.price ?? 100 + Math.random() * 1000;
  const delta = (Math.random() - 0.5) * (base * 0.002);
  const price = Math.max(0.01, base + delta);
  const point: PricePoint = { symbol, price: Number(price.toFixed(2)), ts: Date.now(), source: "stub" };
  lastPriceMap.set(symbol, point);
  return point;
}

// GET /api/prices/last?symbol=AAPL
export async function getLastPrice(req: Request, res: Response) {
  const symbol = String(req.query.symbol || "").trim().toUpperCase();
  if (!isValidSymbol(symbol)) {
    res.status(400).json({ ok: false, message: "Símbolo inválido." });
    return;
  }
  try {
    // Aquí podrías llamar una API de últimos trades si la tuvieras
    const point = nextStubPrice(symbol); // stub directo (no dependencia externa)
    res.json({ ok: true, data: point });
  } catch (e: any) {
    const point = nextStubPrice(symbol);
    res.status(200).json({ ok: true, data: point, warning: e?.message || "fallback stub" });
  }
}

// SSE /api/prices/stream?symbol=AAPL
export async function streamLivePriceSSE(req: Request, res: Response) {
  const symbol = String(req.query.symbol || "").trim().toUpperCase();
  if (!isValidSymbol(symbol)) {
    res.status(400).json({ ok: false, message: "Símbolo inválido." });
    return;
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  let alive = true;
  req.on("close", () => { alive = false; });

  const first = nextStubPrice(symbol);
  try {
    res.write(`data: ${JSON.stringify({ type: "price", ...first })}\n\n`);
  } catch {}

  const id = setInterval(() => {
    if (!alive) {
      clearInterval(id);
      return;
    }
    const p = nextStubPrice(symbol);
    try {
      res.write(`data: ${JSON.stringify({ type: "price", ...p })}\n\n`);
    } catch {
      clearInterval(id);
    }
  }, 2000);
}