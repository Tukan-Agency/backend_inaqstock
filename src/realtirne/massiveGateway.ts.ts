import WebSocket from "ws";
import { EventEmitter } from "events";

export interface MassiveGatewayOptions {
  apiKey: string;
  url?: string;              // wss://delayed.massive.com/stocks | wss://socket.massive.com/stocks | .../options | .../forex
  enabled?: boolean;
  logPrefix?: string;
  mode?: "aggregate" | "trade" | "both"; // cómo emitir precios
}

type PriceEvent = {
  symbol: string;
  price: number;
  ts: number;
  source: "AM" | "T";
};

function backoff(attempt: number) {
  const max = 30_000;
  return Math.min(max, 1000 * Math.pow(2, attempt));
}

/**
 * Gateway para Massive (stocks / options / forex según URL).
 * Eventos:
 *  - status: { type: open|close|error|authed|limit|info, detail? }
 *  - price:  PriceEvent
 */
export class MassiveGateway extends EventEmitter {
  private apiKey: string;
  private url: string;
  private ws: WebSocket | null = null;
  private connected = false;
  private authed = false;
  private retry = 0;
  private wantOpen = false;
  private subs = new Set<string>();
  private enabled: boolean;
  private logPrefix: string;
  private mode: "aggregate" | "trade" | "both";

  constructor(opts: MassiveGatewayOptions) {
    super();
    this.apiKey = opts.apiKey;
    this.url = opts.url || "wss://delayed.massive.com/stocks";
    this.enabled = opts.enabled !== false;
    this.logPrefix = opts.logPrefix || "[MassiveGW]";
    this.mode = opts.mode || "aggregate";
  }

  start() {
    if (!this.enabled) {
      console.warn(this.logPrefix, "Deshabilitado (sin API key).");
      return;
    }
    if (this.wantOpen) return;
    this.wantOpen = true;
    this.open();
  }

  stop() {
    this.wantOpen = false;
    this.authed = false;
    this.connected = false;
    try {
      this.ws?.removeAllListeners();
      this.ws?.close(1000, "client_stop");
    } catch {}
    this.ws = null;
  }

  subscribe(symbol: string) {
    const s = normalizeSymbol(symbol);
    if (!s) return;
    this.subs.add(s);
    if (this.connected && this.authed) {
      this.sendSubscriptions([s]);
    }
  }

  unsubscribe(symbol: string) {
    const s = normalizeSymbol(symbol);
    this.subs.delete(s);
    // Massive: no hay ejemplo oficial de unsubscribe; dejamos así.
  }

  private open() {
    try {
      console.log(this.logPrefix, "OPENING", this.url);
      this.ws = new WebSocket(this.url);
      this.ws.on("open", () => this.onOpen());
      this.ws.on("close", (code, reason) => this.onClose(code, reason));
      this.ws.on("error", (err) => this.onError(err));
      this.ws.on("message", (data) => this.onMessage(data));
    } catch (e) {
      console.error(this.logPrefix, "ERROR creating WS", e);
      this.scheduleReconnect();
    }
  }

  private onOpen() {
    this.connected = true;
    this.authed = false;
    this.retry = 0;
    this.send({ action: "auth", params: this.apiKey });
    this.emit("status", { type: "open" });
  }

  private onClose(code: number, reason: Buffer) {
    this.connected = false;
    this.authed = false;
    this.emit("status", { type: "close", code, reason: reason?.toString() });
    if (this.wantOpen) this.scheduleReconnect();
  }

  private onError(err: any) {
    this.emit("status", { type: "error", error: err?.message || String(err) });
    try { this.ws?.close(); } catch {}
  }

  private scheduleReconnect() {
    const delay = backoff(this.retry++);
    setTimeout(() => {
      if (this.wantOpen) this.open();
    }, delay);
  }

  private send(obj: any) {
    try {
      this.ws?.send(JSON.stringify(obj));
    } catch (e) {
      console.error(this.logPrefix, "SEND ERROR", (e as any)?.message || e);
    }
  }

  private sendSubscriptions(symbols: string[]) {
    if (!symbols.length) return;

    // Aggregates minuto
    if (this.mode === "aggregate" || this.mode === "both") {
      const paramsAgg = symbols.map((s) => `AM.${s}`).join(",");
      this.send({ action: "subscribe", params: paramsAgg });
      console.log(this.logPrefix, "SUBSCRIBE AGG", paramsAgg);
    }

    // Trades
    if (this.mode === "trade" || this.mode === "both") {
      const paramsTrades = symbols.map((s) => `T.${s}`).join(",");
      this.send({ action: "subscribe", params: paramsTrades });
      console.log(this.logPrefix, "SUBSCRIBE TRADES", paramsTrades);
    }
  }

  private onMessage(raw: WebSocket.RawData) {
    let msgs: any[] = [];
    try {
      msgs = JSON.parse(raw.toString());
      if (!Array.isArray(msgs)) msgs = [msgs];
    } catch {
      return;
    }

    for (const m of msgs) {
      if (m?.ev === "status") {
        if (m.status === "auth_success") {
          this.authed = true;
          this.emit("status", { type: "authed" });
          if (this.subs.size > 0) {
            this.sendSubscriptions([...this.subs]);
          }
        } else if (/max/i.test(m.status || "") || /Maximum/.test(m.message || "")) {
          this.emit("status", { type: "limit", detail: m });
          this.wantOpen = false;
          try { this.ws?.close(4000, "limit"); } catch {}
        } else {
          this.emit("status", { type: "info", detail: m });
        }
        continue;
      }

      // Aggregates minuto: ev:'AM'
      if (m.ev === "AM" && (this.mode === "aggregate" || this.mode === "both")) {
        const symbol = normalizeSymbol(m.sym || m.ticker || m.symbol);
        const close = Number(m.c);
        if (symbol && Number.isFinite(close)) {
          const priceEvent: PriceEvent = {
            symbol,
            price: close,
            ts: Number(m.s) || Date.now(),
            source: "AM",
          };
          this.emit("price", priceEvent);
        }
      }

      // Trades: ev:'T'
      if (m.ev === "T" && (this.mode === "trade" || this.mode === "both")) {
        const symbol = normalizeSymbol(m.sym || m.ticker || m.symbol);
        const tradePrice = Number(m.p);
        if (symbol && Number.isFinite(tradePrice)) {
          const priceEvent: PriceEvent = {
            symbol,
            price: tradePrice,
            ts: Number(m.t) || Date.now(),
            source: "T",
          };
          this.emit("price", priceEvent);
        }
      }
    }
  }
}

function normalizeSymbol(raw: any): string {
  if (!raw) return "";
  return String(raw).trim().toUpperCase();
}