import { Request, Response } from "express";
import fs from "fs";
import path from "path";

// CORRECCIÓN: Ruta absoluta a la carpeta 'data' en la raíz
const SETTINGS_DIR = path.join(process.cwd(), 'data');
const SETTINGS_PATH = path.join(SETTINGS_DIR, 'settings.json');

// Helper para leer
const readSettings = () => {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) {
      return {
        platformTitle: "InaqStock",
        resendApiKey: "",
        polygonApiKey: "",
        openRouterApiKey: "",
        logoLight: "",
        logoDark: ""
      };
    }
    const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    console.error("Error leyendo settings:", error);
    return {};
  }
};

// Helper para escribir
const writeSettings = (data: any) => {
  // Aseguramos que la carpeta 'data' exista en la raíz
  if (!fs.existsSync(SETTINGS_DIR)) {
    fs.mkdirSync(SETTINGS_DIR, { recursive: true });
  }
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2), "utf-8");
};

export const getSettings = async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = readSettings();
    res.json({ ok: true, data });
  } catch (error: any) {
    res.status(500).json({ ok: false, message: "Error al leer ajustes" });
  }
};

export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    // Lee lo actual
    const current = readSettings();
    // Mezcla con lo nuevo que viene en el body
    const updated = { ...current, ...req.body };
    
    // Guarda en el archivo
    writeSettings(updated);

    res.json({ ok: true, message: "Ajustes guardados correctamente", data: updated });
  } catch (error: any) {
    res.status(500).json({ ok: false, message: "Error al guardar ajustes" });
  }
};

export const uploadLogo = async (req: Request, res: Response): Promise<void> => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    
    if (!files || Object.keys(files).length === 0) {
      res.status(400).json({ ok: false, message: "No se enviaron archivos" });
      return;
    }

    const current = readSettings();
    const updated = { ...current };

    // Asumiendo que tu carpeta de uploads también está en la raíz y se sirve estáticamente
    if (files['logoLight'] && files['logoLight'][0]) {
       updated.logoLight = `/uploads/${files['logoLight'][0].filename}`;
    }

    if (files['logoDark'] && files['logoDark'][0]) {
       updated.logoDark = `/uploads/${files['logoDark'][0].filename}`;
    }

    writeSettings(updated);

    res.json({ 
      ok: true, 
      message: "Logos actualizados", 
      logoLight: updated.logoLight,
      logoDark: updated.logoDark
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, message: "Error al subir logos", error: error.message });
  }
};