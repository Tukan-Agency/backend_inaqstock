import { WebSocket } from "ws";
import { MassiveGateway } from "./massiveGateway.ts";

/**
 * Distribuye eventos de precio a clientes WebSocket del backend.
 */
export class MassivePriceHub {
  private gateway: MassiveGateway;
  private clients = new Set<{ ws: WebSocket; symbol: string }>();
  private counts = new Map<string, number>();

  constructor(gateway: MassiveGateway) {
    this.gateway = gateway;
    this.gateway.on("price", (msg: any) => {
      const payload = JSON.stringify({
        type: "price",
        symbol: msg.symbol,
        price: msg.price,
        ts: msg.ts,
        source: msg.source,
      });
      this.broadcastSymbol(msg.symbol, payload);
    });
  }

  start() {
    this.gateway.start();
  }

  addClient(ws: WebSocket, symbol: string) {
    const sym = symbol.toUpperCase().trim();
    this.clients.add({ ws, symbol: sym });

    const n = (this.counts.get(sym) || 0) + 1;
    this.counts.set(sym, n);
    if (n === 1) {
      this.gateway.subscribe(sym);
    }

    ws.on("close", () => this.removeClient(ws, sym));
    ws.on("error", () => this.removeClient(ws, sym));

    ws.send(JSON.stringify({ type: "welcome", symbol: sym }));
  }

  private removeClient(ws: WebSocket, symbol: string) {
    let removed = false;
    for (const c of this.clients) {
      if (c.ws === ws && c.symbol === symbol) {
        this.clients.delete(c);
        removed = true;
      }
    }
    if (!removed) return;

    const curr = this.counts.get(symbol) || 0;
    const next = Math.max(0, curr - 1);
    if (next === 0) {
      this.counts.delete(symbol);
      // (No unsubscribe implementado por Massive)
    } else {
      this.counts.set(symbol, next);
    }
  }

  private broadcastSymbol(symbol: string, payload: string) {
    for (const c of this.clients) {
      if (c.symbol === symbol && c.ws.readyState === c.ws.OPEN) {
        try { c.ws.send(payload); } catch {}
      }
    }
  }
}