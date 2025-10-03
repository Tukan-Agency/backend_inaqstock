import { Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { Document, Types } from "mongoose";
import User, { IUser } from "../model/userModel";
import UserOtp from "../model/userOtp";
import { sendEmailVerify } from "./emailController";
import { getUserByEmail } from "./services/userService";

dotenv.config();

//     await redis.del(`user:${email}`);
// ESTO CUANDO EL USUARIO SE ACTUALICE

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

    const user = await getUserByEmail(email);

    if (!user) {
      res.status(400).json({ status: "error", message: "Usuario no encontrado" });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ status: "error", message: "Credenciales inválidas" });
      return;
    }

    // CAMBIO AQUÍ: Incluir el ID del usuario en el payload del token
    const payload = { 
      id: (user._id as Types.ObjectId).toString(),
      email, 
      username: user.username,
      surname: user.surname,
    };
    const token = jwt.sign(payload, secret, { expiresIn: "1h" });

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({ status: "exito", message: "Ingreso exitoso", user });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: "Error al iniciar sesión", error: error.message });
  }
};

export const checkEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      res.status(400).json({ exists: false, message: "Correo no válido" });
      return;
    }

    const existingUser = await getUserByEmail(email);

    res.status(200).json({ exists: !!existingUser });
  } catch (error: any) {
    res.status(500).json({
      exists: false,
      message: "Error al verificar el correo",
      error: error.message,
    });
  }
};

export const addUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, surname, birthday, email, password, username, address, company, contactNumber, whatsapp, country, currency, role, package: userPackage, sequenceId } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ message: "Este correo ya está registrado" });
      return;
    }

    const hashed = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name,
      surname,
      birthday,
      email,
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
      sequenceId,
    }) as Document<unknown, {}, IUser> & IUser & { _id: string };

    const emailSent = await sendEmailVerify(newUser._id);
    if (emailSent) {
      res.status(201).json({ message: "Usuario registrado. Verifique su correo.", user: newUser });
    } else {
      throw new Error("Error al enviar correo de verificación");
    }
  } catch (error: any) {
    res.status(500).json({ message: "Error al registrar usuario", error: error.message });
    console.log(error);
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

export const getSession = (req: AuthenticatedRequest, res: Response): void => {
  // Toma el token de cookie o de Authorization: Bearer
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.split(" ")[1]
    : undefined;

  const token = req.cookies?.token || bearer;

  if (!token) {
    res.status(401).json({ message: "Token no proporcionado" });
    return;
  }

  jwt.verify(token, secret, async (err: jwt.VerifyErrors | null, decoded: any) => {
    if (err) {
      res.status(401).json({ message: "Token inválido", error: err });
      return;
    }

    try {
      // Preferir buscar por id del payload (más robusto). Fallback a email si no hay id.
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

      // Saneamos: omitimos password, __v, email y surname (según pediste)
      const raw = typeof (user as any).toObject === "function" ? (user as any).toObject() : user;
      const {
        password: _omitPassword,
        __v: _omitV,
        email: _omitEmail,      // omitido
        surname: _omitSurname,  // omitido
        ...rest
      } = raw;

      // Normalizamos _id a string
      const idString = (user._id as Types.ObjectId).toString();

      // Normalizamos birthday a ISO (si viene como Date); el resto queda tal cual
      const birthdayISO =
        rest?.birthday instanceof Date ? rest.birthday.toISOString() : rest?.birthday;

      const userResponse = {
        ...rest,               // name, address, company, contactNumber, whatsapp, country, currency, role, sequenceId, username, etc.
        birthday: birthdayISO, // normalizado a ISO
        _id: idString,         // string
        id: idString,          // alias
        clientId: idString,    // alias para el frontend
      };

      res.status(200).json({
        status: "exito",
        id: (user._id as Types.ObjectId).toString(),
        name: user.name,
        apellido: user.surname,
        email: user.email,
        username: user.username,
        user: userResponse,
        token,              // si no lo quieres en la respuesta, puedes quitarlo
        iat: decoded?.iat,  // tiempos del token
        exp: decoded?.exp,
      });
    } catch (err: any) {
      res.status(500).json({ message: "Error al obtener datos del usuario", error: err.message });
    }
  });
};

export const VerifyUser = async (req: Request, res: Response): Promise<void> => {
  const { id, code } = req.body;
  try {
    if (!id || !code) throw new Error("Se requiere código OTP");

    const verifyCode = await UserOtp.findOne({ user_id: id });
    if (!verifyCode) throw new Error("Código no encontrado o ya verificado");

    const { expiresAt, otp } = verifyCode;
    if (expiresAt.getTime() < Date.now()) {
      await UserOtp.deleteMany({ user_id: id });
      throw new Error("Código expirado. Solicite uno nuevo.");
    }

    const validOtp = await bcrypt.compare(code.toString(), otp);
    if (!validOtp) throw new Error("Código OTP inválido");

    await User.updateOne({ _id: id }, { verifiedAt: Date.now() });
    await UserOtp.deleteMany({ user_id: id });

    const user = await User.findById(id);
    
    // CAMBIO AQUÍ: Incluir el ID del usuario en el payload del token
    const payload = { 
      id: (user?._id as Types.ObjectId).toString(),
      email: user?.email, 
      username: user?.username 
    };
    const token = jwt.sign(payload, secret, { expiresIn: "24h" });

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({ status: "Verified", message: "Correo verificado exitosamente" });
  } catch (e: any) {
    res.status(400).json({ status: "failed", message: e.message });
  }
};

export const resendOtp = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.body;
  try {
    if (!id) throw new Error("Id requerido");

    const user = await User.findOne({ _id: id, verifiedAt: null });
    if (!user) throw new Error("Usuario no encontrado o ya verificado");

    await UserOtp.deleteMany({ user_id: id });

    const emailSent = await sendEmailVerify(id.toString());
    if (emailSent) {
      res.status(200).json({ message: `Nuevo código enviado a ${user.email}` });
    } else {
      throw new Error("No se pudo enviar el correo");
    }
  } catch (e: any) {
    res.status(404).json({ message: e.message });
  }
};