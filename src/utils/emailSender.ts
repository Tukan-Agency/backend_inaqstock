import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';

// Función auxiliar para leer la configuración
const getSettings = () => {
  try {
    // CORRECCIÓN: Apuntar a la carpeta 'data' en la raíz del proyecto, NO en src
    // Esto funcionará tanto en dev (ts-node) como en prod (node dist/index.js)
    // siempre que ejecutes el comando desde la raíz.
    const settingsPath = path.join(process.cwd(), 'data', 'settings.json');
    
    if (fs.existsSync(settingsPath)) {
      const rawData = fs.readFileSync(settingsPath, 'utf-8');
      return JSON.parse(rawData);
    }
  } catch (error) {
    console.error("Error leyendo settings.json:", error);
  }
  return {};
};

export const sendRecoveryEmail = async (email: string, token: string) => {
  try {
    const settings = getSettings();
    // Prioridad: settings.json -> variable de entorno -> string vacío
    const apiKey = settings.resendApiKey || process.env.RESEND_API_KEY; 
    const platformName = settings.platformTitle || "InaqStock";

    if (!apiKey) {
      console.log("Falta la API Key de Resend. Verifica settings.json o .env");
      return false;
    }

    const resend = new Resend(apiKey);
    const frontUrl = process.env.FRONT_URL_PROD || 'http://localhost:5173';
    
    // Limpieza de URL para evitar dobles slashes
    const baseUrl = frontUrl.endsWith('/') ? frontUrl.slice(0, -1) : frontUrl;
    const recoveryUrl = `${baseUrl}/reset-password?token=${token}`;

    const { data, error } = await resend.emails.send({
      from: `Soporte <no-reply@lionsoftgt.site>`, 
      to: [email],
      subject: `Recuperación de Contraseña - ${platformName}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #00689B;">Recupera tu acceso a ${platformName}</h2>
          <p>Has solicitado restablecer tu contraseña.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${recoveryUrl}" style="background-color: #00689B; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              Restablecer Contraseña
            </a>
          </div>
          <p style="font-size: 12px; color: #999;">Si no solicitaste este cambio, ignora este correo.</p>
        </div>
      `,
    });

    if (error) {
      console.log("Error enviando email Resend:", error);
      return false;
    }
    console.log("Email enviado con éxito:", data);
    return true;
  } catch (err) {
    console.log("Error en sendRecoveryEmail:", err);
    return false;
  }
};