import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const rawSecret = process.env.AUTH_SECRET;
if (!rawSecret) {
  throw new Error("AUTH_SECRET is not defined in environment variables.");
}
const secret: string = rawSecret;

export interface AuthenticatedRequest extends Request {
  user?: string | JwtPayload;
}

function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = req.cookies?.token;

  if (!token) {
    res.status(401).json({ message: "No Token" });
    return;
  }

  try {
    req.user = jwt.verify(token, secret);
    next();
  } catch (err) {
    res.status(403).json({ message: "Invalid Token" });
  }
}

export default authenticate;
