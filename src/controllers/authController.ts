import { Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import User, { IUser } from "../model/userModel";
import UserOtp from "../model/userOtp";
import { sendEmailVerify } from "./emailController"; // usado en resendOtp / VerifyUser
import {
  getUserByEmail,
  purgeUserCache,
} from "../controllers/services/userService"; // <- añadimos purge
import { getNextSequence, peekNextSequence } from "../utils/getNextSequence";

dotenv.config();

const secret = process.env.AUTH_SECRET;
if (!secret) {
  throw new Error("AUTH_SECRET not defined in environment variables.");
}

interface AuthenticatedRequest extends Request {
  user?: JwtPayload | string;
}

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const emailNorm = String(email || "")
      .trim()
      .toLowerCase();
    const user = await getUserByEmail(emailNorm); // login sí puede beneficiarse de cache

    if (!user) {
      res
        .status(400)
        .json({ status: "error", message: "Usuario no encontrado" });
      return;
    }

    const isMatch = await bcrypt.compare(String(password || ""), user.password);
    if (!isMatch) {
      res
        .status(401)
        .json({ status: "error", message: "Credenciales inválidas" });
      return;
    }

    const payload = {
      id: String(user._id),
      email: user.email,
      username: user.username,
      surname: user.surname,
    };
    const token = jwt.sign(payload, secret, { expiresIn: "8h" });

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      // Opcional: Ajusta también la duración de la cookie para que coincida (en milisegundos)
      // Ejemplo para 8 horas: 8 * 60 * 60 * 1000
      maxAge: 8 * 60 * 60 * 1000, 
    });

    res.status(200).json({ status: "exito", message: "Ingreso exitoso", user });
  } catch (error: any) {
    res
      .status(500)
      .json({
        status: "error",
        message: "Error al iniciar sesión",
        error: error.message,
      });
  }
};

/**
 * Check-email SIN leer de Redis: consulta DB directo y purga cache si existiera basura.
 */
export const checkEmail = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    if (!email) {
      res.status(400).json({ exists: false, message: "Correo no válido" });
      return;
    }

    // Consultamos directo a Mongo para evitar falsos positivos por cache
    const existing = await User.exists({ email });

    if (!existing) {
      // Por si quedó basura en Redis, purgamos esa clave
      await purgeUserCache({ email }).catch(() => {});
    }

    res.status(200).json({ exists: !!existing });
  } catch (error: any) {
    res.status(500).json({
      exists: false,
      message: "Error al verificar el correo",
      error: error.message,
    });
  }
};

/**
 * Ver próximo sequenceId (no reserva).
 * GET /api/users/sequence/peek
 */
export const peekSequence = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const next = await peekNextSequence("user_sequence", 10000);
    res.status(200).json({ next });
  } catch (e: any) {
    res
      .status(500)
      .json({ message: "Error al consultar próximo ID", error: e.message });
  }
};

/**
 * Registrar usuario SIN enviar correo/OTP y asignando sequenceId de forma atómica.
 * - Ignora cualquier sequenceId del body (servidor asigna).
 * - A prueba de carreras: reintenta si choca con índice unique (E11000).
 * - Marca verifiedAt inmediatamente (registro directo).
 * - Hace login automático y setea cookie.
 */
export const addUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      surname,
      birthday,
      email,
      password,
      username,
      address,
      company,
      contactNumber,
      whatsapp,
      country,
      currency,
      sequenceId, // El sequenceId recibido desde el frontend
      role,
      package: userPackage,
    } = req.body || {};

    const emailNorm = String(email || "")
      .trim()
      .toLowerCase();
    if (!emailNorm) {
      res.status(400).json({ message: "Correo no válido" });
      return;
    }

    // Verificar si el correo ya está registrado
    const exists = await User.exists({ email: emailNorm });
    if (exists) {
      res.status(409).json({ message: "Este correo ya está registrado" });
      return;
    }

    // Hashear la contraseña
    const hashed = await bcrypt.hash(String(password || ""), 10);

    try {
      // Crear el nuevo usuario con el sequenceId proporcionado
      const newUser = await User.create({
        name,
        surname,
        birthday,
        email: emailNorm,
        password: hashed,
        username,
        address,
        company,
        contactNumber,
        whatsapp,
        country,
        currency,
        role,
        package: userPackage,
        verifiedAt: new Date(), // Verificado directamente
        sequenceId: sequenceId, // Usar el sequenceId proporcionado por el frontend
      });

      // Crear el token de sesión
      const payload = {
        id: String(newUser._id),
        email: newUser.email,
        username: newUser.username,
      };
      const token = jwt.sign(payload, secret, { expiresIn: "24h" });

      // Configurar la cookie con el token
      res.cookie("token", token, {
        httpOnly: true,
        secure: false,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(201).json({
        message: "Usuario registrado correctamente",
        user: newUser,
      });
    } catch (err: any) {
      if (err?.code === 11000 && err?.keyPattern && err.keyPattern.sequenceId) {
        res
          .status(409)
          .json({
            message: "Duplicado en índice único (sequenceId). Reintente.",
          });
        return;
      }
      res
        .status(500)
        .json({
          message: "Error al registrar usuario",
          error: err?.message || String(err),
        });
    }
  } catch (error: any) {
    res
      .status(500)
      .json({ message: "Error al registrar usuario", error: error.message });
  }
};
export const logout = (req: Request, res: Response): void => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: false,
    sameSite: "strict",
  });
  res.status(200).json({ message: "Sesión cerrada correctamente" });
};

export const getSequenceIds = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    // Encuentra el sequenceId más grande en la colección de usuarios
    const maxSequenceUser = await User.findOne()
      .sort({ sequenceId: -1 })
      .select("sequenceId")
      .lean();
    const maxSequenceId = maxSequenceUser?.sequenceId || 10000; // Si no hay usuarios, empieza en 10000
    const nextSequenceId = maxSequenceId + 1;

    res.status(200).json({ sequenceId: nextSequenceId });
  } catch (error: any) {
    res
      .status(500)
      .json({
        message: "Error al obtener el sequenceId",
        error: error.message,
      });
  }
};
export const getSession = (req: AuthenticatedRequest, res: Response): void => {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.split(" ")[1]
    : undefined;

  const token = req.cookies?.token || bearer;

  if (!token) {
    res.status(401).json({ message: "Token no proporcionado" });
    return;
  }

  jwt.verify(
    token,
    secret,
    async (err: jwt.VerifyErrors | null, decoded: any) => {
      if (err) {
        res.status(401).json({ message: "Token inválido", error: err });
        return;
      }

      try {
        const userId = decoded?.id as string | undefined;
        const userEmail = decoded?.email as string | undefined;

        let user = userId ? await User.findById(userId) : undefined;
        if (!user && userEmail) {
          user = await User.findOne({ email: userEmail });
        }

        if (!user) {
          res.status(401).json({ message: "Usuario no encontrado" });
          return;
        }

        const raw =
          typeof (user as any).toObject === "function"
            ? (user as any).toObject()
            : user;
        const {
          password: _omitPassword,
          __v: _omitV,
          email: _omitEmail,
          surname: _omitSurname,
          ...rest
        } = raw;

        const idString = String(user._id);
        const birthdayISO =
          rest?.birthday instanceof Date
            ? rest.birthday.toISOString()
            : rest?.birthday;

        const userResponse = {
          ...rest,
          birthday: birthdayISO,
          _id: idString,
          id: idString,
          clientId: idString,
        };

        res.status(200).json({
          status: "exito",
          id: idString,
          name: user.name,
          apellido: user.surname,
          email: user.email,
          username: user.username,
          user: userResponse,
          token,
          iat: decoded?.iat,
          exp: decoded?.exp,
        });
      } catch (err: any) {
        res
          .status(500)
          .json({
            message: "Error al obtener datos del usuario",
            error: err.message,
          });
      }
    }
  );
};

export const VerifyUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id, code } = req.body;
  try {
    if (!id || !code) {
      res
        .status(400)
        .json({ status: "failed", message: "Se requiere código OTP" });
      return;
    }

    const verifyCode = await UserOtp.findOne({ user_id: id });
    if (!verifyCode) {
      res
        .status(400)
        .json({
          status: "failed",
          message: "Código no encontrado o ya verificado",
        });
      return;
    }

    const { expiresAt, otp } = verifyCode;
    if (expiresAt.getTime() < Date.now()) {
      await UserOtp.deleteMany({ user_id: id });
      res
        .status(400)
        .json({
          status: "failed",
          message: "Código expirado. Solicite uno nuevo.",
        });
      return;
    }

    const validOtp = await bcrypt.compare(String(code), otp);
    if (!validOtp) {
      res
        .status(400)
        .json({ status: "failed", message: "Código OTP inválido" });
      return;
    }

    await User.updateOne({ _id: id }, { verifiedAt: Date.now() });
    await UserOtp.deleteMany({ user_id: id });

    const user = await User.findById(id);

    const payload = {
      id: String(user?._id),
      email: user?.email,
      username: user?.username,
    };
    const token = jwt.sign(payload, secret, { expiresIn: "24h" });

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res
      .status(200)
      .json({ status: "Verified", message: "Correo verificado exitosamente" });
  } catch (e: any) {
    res.status(400).json({ status: "failed", message: e.message });
  }
};

export const resendOtp = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.body;
  try {
    if (!id) {
      res.status(400).json({ message: "Id requerido" });
      return;
    }

    const user = await User.findOne({ _id: id, verifiedAt: null });
    if (!user) {
      res
        .status(404)
        .json({ message: "Usuario no encontrado o ya verificado" });
      return;
    }

    await UserOtp.deleteMany({ user_id: id });

    const emailSent = await sendEmailVerify(String(id));
    if (emailSent) {
      res.status(200).json({ message: `Nuevo código enviado a ${user.email}` });
    } else {
      res.status(500).json({ message: "No se pudo enviar el correo" });
    }
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
};
