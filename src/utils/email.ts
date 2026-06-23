import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger';

export interface SendEmailOptions {
  email: string;
  subject: string;
  message: string;
  html?: string;
}

export const sendEmail = async (options: SendEmailOptions): Promise<void> => {
  // Create transporter
  const transporter = nodemailer.createTransport({
    host: env.EMAIL_HOST,
    port: env.EMAIL_PORT,
    auth: {
      user: env.EMAIL_USER,
      pass: env.EMAIL_PASS,
    },
  });

  // Define email options
  const mailOptions = {
    from: `Trao Travel Planner <${env.EMAIL_FROM}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  // Send the email
  try {
    if (!env.EMAIL_USER || env.EMAIL_USER === '') {
      logger.info('SMTP credentials not configured. Logging mock email details:');
      logger.info('================= MOCK EMAIL =================');
      logger.info(`TO:      ${options.email}`);
      logger.info(`SUBJECT: ${options.subject}`);
      logger.info(`MESSAGE:\n${options.message}`);
      logger.info('==============================================');
      return;
    }
    await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${options.email}`);
  } catch (error: any) {
    logger.error(`Failed to send email: ${error?.message || error}`);
    logger.info('================= FALLBACK MOCK EMAIL =================');
    logger.info(`TO:      ${options.email}`);
    logger.info(`SUBJECT: ${options.subject}`);
    logger.info(`MESSAGE:\n${options.message}`);
    logger.info('=======================================================');
  }
};
