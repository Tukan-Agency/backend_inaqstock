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
  // Buscar token en Cookie O Header
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.split(" ")[1]
    : undefined;
  const token = req.cookies?.token || bearer;

  if (!token) {
    res.status(401).json({ message: "No Token" });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    
    // CORRECCIÓN CRÍTICA: Buscar por ID, no por email.
    let user = null;
    if (decoded.id) {
        user = await User.findById(decoded.id);
    } else if (decoded.email) {
        // Fallback
        user = await User.findOne({ email: decoded.email });
    }

    if (!user) {
      res.status(401).json({ message: "Usuario no encontrado" });
      return;
    }

    // Inyectar usuario en la request
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