import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

// Función auxiliar para leer la configuración
const getSettings = () => {
  try {
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

// Configuración del transporter SMTP para cPanel
const createTransporter = () => {
  const settings = getSettings();
  
  // Prioridad: settings.json -> variables de entorno
  const smtpConfig = {
    host: settings.smtpHost || process.env.SMTP_HOST || 'mail.nydaqstock.com',
    port: settings.smtpPort || parseInt(process.env.SMTP_PORT || '465'),
    secure: true, // true para puerto 465 (SSL)
    auth: {
      user: settings.smtpUser || process.env.SMTP_USER || 'recuperacion@nydaqstock.com',
      pass: settings.smtpPass || process.env.SMTP_PASS || 'CONTRASEÑA1oqNBWWWZdtXFt#l'
    },
    tls: {
      rejectUnauthorized: false // Puede ser necesario para algunos servidores
    }
  };

  console.log('Configurando SMTP con:', {
    host: smtpConfig.host,
    port: smtpConfig.port,
    user: smtpConfig.auth.user
  });

  return nodemailer.createTransport(smtpConfig);
};

// Función para enviar cualquier email genérico
export const sendEmail = async ({ 
  to, 
  subject, 
  html, 
  from = 'Nydaqstock <recuperacion@nydaqstock.com>' 
}: { 
  to: string; 
  subject: string; 
  html: string; 
  from?: string 
}) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from,
      to,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email enviado con éxito:", info.messageId);
    return info;
    
  } catch (err) {
    console.error("❌ Error enviando email:", err);
    throw err;
  }
};

// Función específica para recuperación de contraseña
export const sendRecoveryEmail = async (email: string, token: string) => {
  try {
    const settings = getSettings();
    const platformName = settings.platformTitle || "Nydaqstock";
    
    const frontUrl = process.env.FRONT_URL_PROD || 'http://localhost:5173';
    const baseUrl = frontUrl.endsWith('/') ? frontUrl.slice(0, -1) : frontUrl;
    const recoveryUrl = `${baseUrl}/reset-password?token=${token}`;

    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #00689B;">Recupera tu acceso a ${platformName}</h2>
        <p>Has solicitado restablecer tu contraseña.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${recoveryUrl}" style="background-color: #00689B; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
            Restablecer Contraseña
          </a>
        </div>
        <p>O copia y pega este enlace en tu navegador:</p>
        <p style="background-color: #f5f5f5; padding: 10px; border-radius: 5px; word-break: break-all;">
          ${recoveryUrl}
        </p>
        <p style="font-size: 12px; color: #999;">Si no solicitaste este cambio, ignora este correo.</p>
        <p style="font-size: 12px; color: #999;">Este enlace expirará en 1 hora.</p>
      </div>
    `;

    await sendEmail({
      from: `${platformName} <recuperacion@nydaqstock.com>`,
      to: email,
      subject: `Recuperación de Contraseña - ${platformName}`,
      html,
    });

    return true;
  } catch (err) {
    console.log("Error en sendRecoveryEmail:", err);
    return false;
  }
};

// Función para enviar email de verificación
export const sendVerificationEmail = async (email: string, username: string, code: number) => {
  try {
    const settings = getSettings();
    const platformName = settings.platformTitle || "Nydaqstock";

    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #00689B;">Verifica tu cuenta en ${platformName}</h2>
        <p>Hola ${username},</p>
        <p>Gracias por registrarte. Usa el siguiente código para verificar tu cuenta:</p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="background-color: #00689B; color: white; padding: 20px; border-radius: 5px; display: inline-block; font-size: 28px; font-weight: bold; letter-spacing: 8px; font-family: monospace;">
            ${code}
          </div>
        </div>
        <p>Introduce este código en la aplicación para completar tu verificación.</p>
        <p style="font-size: 12px; color: #999;">Este código expirará en 1 hora.</p>
        <p style="font-size: 12px; color: #999;">Si no solicitaste esta verificación, ignora este correo.</p>
      </div>
    `;

    await sendEmail({
      from: `${platformName} <recuperacion@nydaqstock.com>`,
      to: email,
      subject: `Verificación de cuenta - ${platformName}`,
      html,
    });

    return true;
  } catch (err) {
    console.error("Error en sendVerificationEmail:", err);
    return false;
  }
};

// Función para testear conexión SMTP
export const testSMTPConnection = async (): Promise<boolean> => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log("✅ Conexión SMTP verificada exitosamente");
    return true;
  } catch (error) {
    console.error("❌ Error verificando conexión SMTP:", error);
    return false;
  }
};