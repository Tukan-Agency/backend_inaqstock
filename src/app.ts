import express, { Application } from "express";
import path from "path";
import dotenv from "dotenv";
import cors, { CorsOptions } from "cors";
import cookieParser from "cookie-parser";
import ejs from "ejs";

import "./db/db";

import authRouter from "./routes/authRouter";
import balanceRouter from "./routes/balanceRouter";
import positionRouter from "./routes/positionRouter";
import movementRouter from "./routes/movementRouter";
import orderRouter from "./routes/orderRouter";
import userRoutes from "./routes/userRouter";
import verificationRouter from "./routes/verificationRouter";
import { UPLOADS_DIR } from "./config/paths";

dotenv.config();

const app: Application = express();

const url_desarrollo = process.env.FRONT_URL_DEV;
const url_produccion = process.env.FRONT_URL_PROD;
const url_dominio = process.env.DOMINIO_URL;

const allowedOrigins = [url_desarrollo, url_produccion, url_dominio].filter(Boolean);

// Middlewares
app.use(cookieParser());
app.use(express.json());

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Accept",
    "Content-Type",
    "Authorization",
    "Cache-Control",
    "Expires",
    "Pragma",
    "x-clientid",
    "x-clientId",
    "x-requestid",
    "x-requestId",
    "x-movementid",
    "x-movementId",
  ],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.urlencoded({ extended: false }));

// Servir archivos subidos SIEMPRE desde la misma ruta absoluta
app.use("/uploads", express.static(UPLOADS_DIR));

// Rutas API
app.use("/api/auth", authRouter);
app.use("/api/users", userRoutes);
app.use("/api/positions", positionRouter);
app.use("/api/movements", movementRouter);
app.use("/api/orders", orderRouter);
app.use("/api/balance", balanceRouter);
app.use("/api/verification", verificationRouter);

// Template Engine
app.set("port", process.env.PORT || 3000);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "/config/email/views"));

export default app;