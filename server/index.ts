import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { initDatabase } from './db/index.js';
import { authRouter } from './routes/auth.js';
import { logsRouter } from './routes/logs.js';
import { tagsRouter } from './routes/tags.js';
import { statsRouter } from './routes/stats.js';
import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security & Parsing Middlewares
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(cookieParser());

// Health Check API
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    env: config.nodeEnv,
  });
});

// Mount Modular API Routes
app.use('/api/auth', authRouter);
app.use('/api/logs', logsRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/stats', statsRouter);

// Resolve static frontend assets with fallback search
const possibleClientPaths = [
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(__dirname, '../client/dist'),
  path.resolve(process.cwd(), 'client/dist'),
  path.resolve(process.cwd(), 'dist/client'),
];

const clientDistPath = possibleClientPaths.find((p) => fs.existsSync(p)) || possibleClientPaths[0];
console.log(`[WorkLog Static Assets Path]: ${clientDistPath} (exists: ${fs.existsSync(clientDistPath)})`);

app.use(express.static(clientDistPath));

// Fallback for Single Page Application routing (SPA)
app.get('*', (req: Request, res: Response, next) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: `API route ${req.method} ${req.path} not found` });
    return;
  }
  const indexPath = path.join(clientDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send(`WorkLog frontend not found at ${indexPath}. Please run npm run build.`);
  }
});

// Centralized error handler
app.use(errorHandler);

// Start Server and ensure DB Schema is ready
async function startServer() {
  try {
    console.log('Connecting to PostgreSQL database...');
    await initDatabase();

    app.listen(config.port, () => {
      console.log(`🚀 WorkLog server running at http://localhost:${config.port}`);
      console.log(`📦 Environment: ${config.nodeEnv}`);
    });
  } catch (err: any) {
    console.error('❌ Failed to start server:', err.message);
    // In dev mode, still listen so user can connect database later if running locally
    if (config.nodeEnv === 'development') {
      app.listen(config.port, () => {
        console.log(`⚠️ WorkLog server started with DB connection pending at http://localhost:${config.port}`);
      });
    } else {
      process.exit(1);
    }
  }
}

startServer();
