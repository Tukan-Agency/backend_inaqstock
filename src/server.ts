import app from "./app";
import url from "url";
import { Server as SocketIOServer } from "socket.io";
import { WebSocketServer } from "ws";
import { MassiveGateway } from "./realtirne/massiveGateway.ts";
import { MassivePriceHub } from "./realtirne/massivePriceHub.ts"; 
import cookie from "cookie";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

// 1. Servidor HTTP
const server = app.listen(app.get("port"), () => {
  console.log(`
██╗     ██╗ ██████╗ ███╗   ██╗███████╗ ██████╗ ███████╗████████╗
██║     ██║██╔═══██╗████╗  ██║██╔════╝██╔═══██╗██╔════╝╚══██╔══╝
██║     ██║██║   ██║██╔██╗ ██║███████╗██║   ██║█████╗     ██║   
██║     ██║██║   ██║██║╚██╗██║╚════██║██║   ██║██╔══╝     ██║   
███████╗██║╚██████╔╝██║ ╚████║███████║╚██████╔╝██║        ██║   
╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚═╝        ╚═╝   

Powered by: LIONSOFT
`);
  console.log("Aplicación en http://localhost:%d (%s)", app.get("port"), app.get("env"));
});

// 2. Socket.IO (Balances)
const io = new SocketIOServer(server, {
  path: "/socket.io/", 
  cors: {
    origin: [
      process.env.FRONT_URL_DEV || "http://localhost:5173",
      process.env.FRONT_URL_TUNEL,
      process.env.FRONT_URL_PROD,
      process.env.DOMINIO_URL
    ].filter(Boolean) as string[],
    credentials: true,
    methods: ["GET", "POST"]
  },
  transports: ["websocket", "polling"]
});

(global as any).io = io;
app.set("socketio", io);

io.on("connection", (socket) => {
  let userId: string | null = null;

  // A) Intentar leer cookie automáticamente
  try {
    if (socket.handshake.headers.cookie) {
      const cookies = cookie.parse(socket.handshake.headers.cookie);
      const token = cookies.token; // Nombre de cookie definido en authController
      
      if (token && process.env.AUTH_SECRET) {
        const decoded: any = jwt.verify(token, process.env.AUTH_SECRET);
        userId = decoded.id || decoded._id;
      }
    }
  } catch (err) {
    // Error silencioso si token invalido
  }

  // Si encontramos ID en cookie, unimos automáticamente
  if (userId) {
    socket.join(userId);
    console.log(`[IO] Usuario AUTO-CONECTADO: ${userId}`);
  }

  // B) Permitir unión manual (Fallback)
  socket.on("join_room", (manualId) => {
    if (manualId) {
      socket.join(manualId);
      if (!userId) console.log(`[IO] Usuario unido MANUALMENTE: ${manualId}`);
    }
  });
});

// 3. WS Precios (Manual)
const wss = new WebSocketServer({ noServer: true });
const apiKey = process.env.MASSIVE_API_KEY || "";
let hub: MassivePriceHub | null = null;

if (apiKey) {
  const gateway = new MassiveGateway({
    apiKey,
    url: process.env.MASSIVE_WS_URL || "wss://delayed.massive.com/stocks",
    mode: "aggregate",
    enabled: true,
    logPrefix: "[MassiveGW]",
  });
  hub = new MassivePriceHub(gateway);
  hub.start();
}

wss.on("connection", (ws, req) => {
  if (req.url && !req.url.startsWith("/ws/prices")) return;
  const { query } = url.parse(req.url || "", true);
  let rawSymbol = String(query?.symbol || "AAPL").trim().toUpperCase();
  if (/^X:[A-Z0-9]+USD$/.test(rawSymbol)) rawSymbol = rawSymbol.replace(/^X:/, "").replace(/USD$/, "USD");
  
  if (hub) hub.addClient(ws, rawSymbol);
});

// 4. Upgrade Handling
server.on('upgrade', (request, socket, head) => {
  const pathname = url.parse(request.url || "").pathname;
  if (pathname === '/ws/prices') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

export default server;