import winston from 'winston';
import { env } from '../config/env';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

const transports: winston.transport[] = [
  new winston.transports.Console()
];

if (env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.File({
      filename: 'logs/app.log'
    })
  );
}

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    env.NODE_ENV === 'development'
      ? combine(colorize(), logFormat)
      : winston.format.json()
  ),
  transports,
});
