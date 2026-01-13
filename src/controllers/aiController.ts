import type { Request, Response } from "express";

// OpenAI Chat Completions (legacy). Si luego migras a Responses API, lo cambiamos.
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export async function searchSymbol(req: Request, res: Response) {
  try {
    const q = String(req.body?.query || "").trim();
    if (!q) {
      res.json({ ok: true, data: [] });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ ok: false, message: "Missing OPENAI_API_KEY in backend env" });
      return;
    }

    const systemPrompt = `Eres un asistente que devuelve símbolos compatibles con Polygon.io.
Reglas:
1) Stocks: Ticker MAYÚSCULAS (ej: AMZN).
2) Cripto: Prefijo X: y termina en USD (ej: X:BTCUSD).
3) Forex: Prefijo C: y par de 6 letras (ej: C:EURUSD).
4) SIN texto extra, solo el código o array JSON de códigos.`;

    const payload = {
      model: "gpt-3.5-turbo",
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Símbolo para: ${q}` },
      ],
    };

    const r = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await r.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // ignore
    }

    if (!r.ok) {
      console.error("[ai] OpenAI error:", r.status, text?.slice(0, 400));
      res.status(502).json({ ok: false, status: r.status, message: "OpenAI request failed", raw: json || text });
      return;
    }

    const content = json?.choices?.[0]?.message?.content ?? "";
    res.json({ ok: true, data: { content } });
  } catch (e: any) {
    console.error("[ai] searchSymbol error:", e?.message || e);
    res.status(500).json({ ok: false, message: e?.message || "Server error" });
  }
}