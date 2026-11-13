import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, isProd } from './config.js';
import { notFound, errorHandler } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import studentRoutes from './routes/student.js';
import adminRoutes from './routes/admin.js';
import commonRoutes from './routes/common.js';

export function createApp() {
  const app = express();
  if (config.trustProxy) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        // No Origin header = curl / server-to-server; browsers always send one.
        if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
        // In development, accept any localhost / 127.0.0.1 port (student 5173, admin 5174, previews).
        if (!isProd && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
        cb(null, false);
      },
      methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );
  app.use(express.json({ limit: '50kb' }));

  // Student side:   /api/auth/*, /api/issues/*
  // Admin side:     /api/admin/*   (own login + admin-only token)
  app.use('/api', commonRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/issues', studentRoutes);
  app.use('/api/admin', adminRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
