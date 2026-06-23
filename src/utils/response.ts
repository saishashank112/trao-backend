import { Response } from 'express';

export const sendResponse = <T>(
  res: Response,
  statusCode: number,
  data: T,
  message?: string
): void => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const sendError = (res: Response, statusCode: number, message: string): void => {
  res.status(statusCode).json({
    success: false,
    message,
  });
};
