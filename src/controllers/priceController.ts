import type { Request, Response } from "express";

type PricePoint = {
  symbol: string;
  price: number;
  ts: number;
  source: "polygon";
  // NUEVO: para mostrar % como “+0.13%”
  prevClose?: number;
  change?: number;
  changePercent?: number;
};

const lastPriceMap = new Map<string, PricePoint>();

function isValidSymbol(symbol?: string): symbol is string {
  if (!symbol) return false;
  // Permitir : para crypto (ej: X:BTCUSD) y . para stocks (ej: BRK.B)
  return /^[A-Z0-9\.\:]{1,20}$/.test(symbol);
}

function safeUrlWithoutKey(url: string) {
  return url.replace(/apiKey=[^&]+/gi, "apiKey=***");
}

async function fetchJson(url: string): Promise<{ ok: boolean; status: number; json: any; text: string }> {
  const res = await fetch(url);
  const status = res.status;
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status, json, text };
}

// STOCKS: Snapshot (last trade + prevDay close)
async function fetchPolygonStockSnapshot(symbol: string, apiKey: string): Promise<PricePoint | null> {
  // Ej: https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/AAPL?apiKey=...
  const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(
    symbol
  )}?apiKey=${encodeURIComponent(apiKey)}`;

  const started = Date.now();
  const r = await fetchJson(url);
  const tookMs = Date.now() - started;

  if (!r.ok) {
    console.error(
      `[prices][snapshot] error symbol=${symbol} status=${r.status} tookMs=${tookMs} url=${safeUrlWithoutKey(url)} body=${(r.text || "")
        .slice(0, 400)}`
    );
    throw new Error(`Polygon snapshot error: ${r.status}`);
  }

  const data = r.json;
  const ticker = data?.ticker;

  // Snapshot shape (Polygon):
  // ticker.lastTrade.p  (último trade)
  // ticker.day.c        (close del día actual, puede existir)
  // ticker.prevDay.c    (close del día anterior)
  const lastTradePrice =
    Number(ticker?.lastTrade?.p) ||
    Number(ticker?.lastQuote?.P) || // por si viene quote
    Number(ticker?.day?.c) || // fallback
    NaN;

  const prevClose = Number(ticker?.prevDay?.c);
  const ts =
    Number(ticker?.lastTrade?.t) ||
    Number(ticker?.lastQuote?.t) ||
    Date.now();

  if (!Number.isFinite(lastTradePrice) || lastTradePrice <= 0) {
    console.warn(
      `[prices][snapshot] no_last_price symbol=${symbol} tookMs=${tookMs} sample=${JSON.stringify(data)?.slice(0, 400)}`
    );
    return null;
  }

  let change: number | undefined = undefined;
  let changePercent: number | undefined = undefined;
  if (Number.isFinite(prevClose) && prevClose > 0) {
    change = lastTradePrice - prevClose;
    changePercent = (change / prevClose) * 100;
  }

  console.log(
    `[prices][snapshot] ok symbol=${symbol} tookMs=${tookMs} last=${lastTradePrice} prevClose=${Number.isFinite(prevClose) ? prevClose : "NA"}`
  );

  return {
    symbol,
    price: Number(lastTradePrice),
    ts: Number(ts) || Date.now(),
    source: "polygon",
    prevClose: Number.isFinite(prevClose) ? Number(prevClose) : undefined,
    change: Number.isFinite(change as number) ? Number(change) : undefined,
    changePercent: Number.isFinite(changePercent as number) ? Number(changePercent) : undefined,
  };
}

// CRYPTO: se deja como estaba (pero tu endpoint original aquí es dudoso para crypto).
async function fetchPolygonCryptoLikeBefore(symbol: string, apiKey: string): Promise<PricePoint | null> {
  const url = `https://api.polygon.io/v2/last/trade/${symbol}?apiKey=${encodeURIComponent(apiKey)}`;

  const started = Date.now();
  const r = await fetchJson(url);
  const tookMs = Date.now() - started;

  if (!r.ok) {
    console.error(
      `[prices][crypto] error symbol=${symbol} status=${r.status} tookMs=${tookMs} url=${safeUrlWithoutKey(url)} body=${(r.text || "")
        .slice(0, 400)}`
    );
    throw new Error(`Polygon API error: ${r.status}`);
  }

  const data = r.json;
  const p = Number(data?.results?.p);
  const t = Number(data?.results?.t);

  if (!Number.isFinite(p)) return null;

  return {
    symbol,
    price: p,
    ts: Number.isFinite(t) ? t : Date.now(),
    source: "polygon",
  };
}

async function fetchPolygonPrice(symbol: string): Promise<PricePoint | null> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) throw new Error("POLYGON_API_KEY not set");

  const isCrypto = symbol.includes(":");

  if (isCrypto) {
    // crypto (como antes)
    return fetchPolygonCryptoLikeBefore(symbol, apiKey);
  }

  // stocks live snapshot
  return fetchPolygonStockSnapshot(symbol, apiKey);
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
  req.on("close", () => {
    alive = false;
  });

  const initial = await fetchPolygonPrice(symbol).catch(() => lastPriceMap.get(symbol));
  if (initial) {
    res.write(`data: ${JSON.stringify({ type: "price", ...initial })}\n\n`);
  }

  const interval = symbol.includes(":") ? 2000 : 2000; // stocks también cada 2s para ver cambios
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
      // mantener vivo
    }
  }, interval);

  req.on("close", () => {
    clearInterval(id);
  });
}