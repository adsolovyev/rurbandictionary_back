import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!);
      (req as any).user = decoded;
    } catch (err) {
      // невалидный токен – просто игнорируем
    }
  }
  next();
};