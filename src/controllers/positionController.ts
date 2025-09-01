import { Request, Response } from "express";
import Position, { IPosition } from "../model/positionModel";
import { JwtPayload } from "jsonwebtoken";

interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}


export const createPosition = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const position = new Position({
      userId: req.user.id,
      ...req.body,
      openTime: new Date(),
      status: 'open'
    });

    position.calculateProfit();
    await position.save();

    res.status(201).json(position);
  } catch (error: any) {
    res.status(500).json({ message: "Error al crear posición", error: error.message });
  }
};

export const closePosition = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { closePrice } = req.body;

    if (!req.user) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const position = await Position.findOne({ _id: id, userId: req.user.id, status: 'open' });
    
    if (!position) {
      res.status(404).json({ message: "Posición no encontrada" });
      return;
    }

    position.closePrice = closePrice;
    position.closeTime = new Date();
    position.status = 'closed';
    position.calculateProfit();
    
    await position.save();

    res.status(200).json(position);
  } catch (error: any) {
    res.status(500).json({ message: "Error al cerrar posición", error: error.message });
  }
};

export const getOpenPositions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const positions = await Position.find({ 
      userId: req.user.id,
      status: 'open'
    }).sort({ openTime: -1 });

    res.status(200).json(positions);
  } catch (error: any) {
    res.status(500).json({ message: "Error al obtener posiciones", error: error.message });
  }
};

export const getClosedPositions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const positions = await Position.find({ 
      userId: req.user.id,
      status: 'closed'
    }).sort({ closeTime: -1 });

    res.status(200).json(positions);
  } catch (error: any) {
    res.status(500).json({ message: "Error al obtener posiciones", error: error.message });
  }
};

export const updatePositionPrice = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { currentPrice } = req.body;

    if (!req.user) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const position = await Position.findOne({ _id: id, userId: req.user.id, status: 'open' });
    
    if (!position) {
      res.status(404).json({ message: "Posición no encontrada" });
      return;
    }

    position.currentPrice = currentPrice;
    position.calculateProfit(); // Ahora TypeScript reconocerá este método
    await position.save();

    res.status(200).json(position);
  } catch (error: any) {
    res.status(500).json({ message: "Error al actualizar precio", error: error.message });
  }
};