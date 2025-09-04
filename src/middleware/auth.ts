import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import dotenv from "dotenv";
import User from "../model/userModel";
import { Types } from "mongoose";

dotenv.config();

const rawSecret = process.env.AUTH_SECRET;
if (!rawSecret) {
  throw new Error("AUTH_SECRET is not defined in environment variables.");
}
const secret: string = rawSecret;

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload & { id: string };
}

async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.cookies?.token;

  if (!token) {
    res.status(401).json({ message: "No Token" });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    
    // Buscar el usuario para obtener su ID
    const user = await User.findOne({ email: decoded.email });
    if (!user) {
      res.status(401).json({ message: "Usuario no encontrado" });
      return;
    }

    // Agregar el ID del usuario al objeto user con el tipado correcto
    req.user = {
      ...decoded,
      id: (user._id as Types.ObjectId).toString()
    };
    
    next();
  } catch (err) {
    res.status(403).json({ message: "Invalid Token" });
  }
}

export default authenticate;