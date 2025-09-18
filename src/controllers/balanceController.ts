// src/controllers/balanceController.ts
import { Request, Response } from "express";
import Order from "../model/orderModel";
import { JwtPayload } from "jsonwebtoken";

interface AuthenticatedRequest extends Request {
  user?: JwtPayload & { id: string };
}

interface IBalanceData {
  balance: number;
  capital: number;
  ganancias: number;
  margen: number;
}


export const getUserBalances = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const userId = req.user.id;

    // Obtener todas las órdenes del usuario
    const orders = await Order.find({ 
      clientId: userId,
      operationStatus: 'Finalizado'
    });

    console.log(`📊 Calculando balances para usuario: ${userId}`);
    console.log(`📋 Órdenes encontradas: ${orders.length}`);

    // Inicializar valores
    let balance = 0;
    let totalCapital = 0;
    let totalGanancia = 0;
    let totalPerdida = 0;
    let totalRetiros = 0;

    // LÓGICA EXACTA DEL PROYECTO OLD
    orders.forEach((order) => {
      // 1. CALCULAR BALANCE (lógica original que ya funciona)
      balance += order.operationValue;
      order.operationActions.forEach((operation) => {
        if (order.isCapital) {
          balance += operation.benefit * operation.quantity;
        }
      });

      // 2. CALCULAR x.total (benefit calculado por orden)
      let totalBenefitOrden = 0;
      order.operationActions.forEach((operation) => {
        if (order.isCapital) {
          totalBenefitOrden += operation.benefit * operation.quantity;
        }
      });

      // 3. CALCULAR valorFinal (operationValue)
      const valorFinal = order.operationValue;

      // 4. APLICAR LÓGICA DEL generatePDF()
      const isCapital = order.isCapital;
      const isWithdrawl = order.isWithdrawl;

      // CAPITAL: suma de totalBenefitOrden donde isCapital = true y NO es retiro
      if (isCapital && !isWithdrawl) {
        totalCapital += totalBenefitOrden;
      }

      // GANANCIAS Y PÉRDIDAS: solo si NO es retiro
      if (!isWithdrawl) {
        if (valorFinal > 0) {
          totalGanancia += valorFinal;
        } else if (valorFinal < 0) {
          totalPerdida += Math.abs(valorFinal);
        }
      }

      // RETIROS: suma de totalBenefitOrden donde isWithdrawl = true
      if (isWithdrawl) {
        totalRetiros += totalBenefitOrden;
      }

      console.log(`🔍 Orden ${order.operationNumber}:`, {
        totalBenefitOrden,
        valorFinal,
        isCapital,
        isWithdrawl
      });
    });

    // MARGEN: ganancias - pérdidas
    const margen = totalGanancia - totalPerdida;

    console.log(`📊 Resultados finales:`, {
      balance,
      totalCapital,
      totalGanancia,
      totalPerdida,
      totalRetiros,
      margen
    });

    const balanceData: IBalanceData = {
      balance: Number(balance.toFixed(2)),
      capital: Number(totalCapital.toFixed(2)),
      ganancias: Number(totalGanancia.toFixed(2)),
      margen: Number(margen.toFixed(2))
    };

    res.status(200).json({
      success: true,
      data: balanceData
    });

  } catch (error: any) {
    console.error('Error calculating balances:', error);
    res.status(500).json({
      success: false,
      message: "Error al calcular balances",
      error: error.message
    });
  }
};

export const getBalancePreferences = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    // Por ahora retornamos las preferencias por defecto
    // Después se puede integrar con el modelo User
    res.status(200).json({
      success: true,
      data: {
        preferences: ['balance'] // Valor por defecto
      }
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al obtener preferencias",
      error: error.message
    });
  }
};

// Actualizar preferencias de balance
export const updateBalancePreferences = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const { preferences } = req.body;

    // Validar preferencias
    const validPreferences = ['balance', 'capital', 'ganancias', 'margen'];
    const isValid = Array.isArray(preferences) && 
                   preferences.every((pref: string) => validPreferences.includes(pref));

    if (!isValid) {
      res.status(400).json({
        success: false,
        message: "Preferencias inválidas"
      });
      return;
    }

    // Por ahora solo confirmamos que se recibieron
    // Después se puede guardar en el modelo User
    res.status(200).json({
      success: true,
      message: "Preferencias actualizadas correctamente",
      data: { preferences }
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al actualizar preferencias",
      error: error.message
    });
  }
};