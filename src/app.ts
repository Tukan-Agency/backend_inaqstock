import express, { Application } from "express";
import path from "path";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import ejs from "ejs";
import authRouter from "./routes/authRouter";
import balanceRouter from "./routes/balanceRouter";
import positionRouter from "./routes/positionRouter";

import "./db/db";


dotenv.config();

const app: Application = express();

const url_desarrollo = process.env.FRONT_URL_DEV;
const url_produccion = process.env.FRONT_URL_PROD;
const url_dominio = process.env.DOMINIO_URL;

const allowedOrigins = [url_desarrollo, url_produccion, url_dominio].filter(Boolean);

// Middlewares
app.use(cookieParser());
app.use(express.json());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "DELETE", "PUT"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cache-Control",
      "Expires",
      "Pragma",
    ],
    credentials: true,
  })
);
app.use(express.urlencoded({ extended: false }));

app.use("/api/auth", authRouter);
app.use("/api/positions", positionRouter); // Agregar esta línea

// Blances
app.use("/api/balance", balanceRouter);

// Template Engine
app.set("port", process.env.PORT || 3000);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "/config/email/views"));

// Exporta sin ejecutar
export default app;
