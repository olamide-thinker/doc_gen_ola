import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });
// fallback if running from within backend folder
if (!process.env.FIREBASE_PRIVATE_KEY) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import * as express from 'express';
import { join } from 'path';
import { Server } from '@hocuspocus/server';
import { initializeFirebase } from './config/firebase';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // 1. Initialize Firebase Admin (Keep for Auth)
  initializeFirebase();

  // 2. Create NestJS App
  const app = await NestFactory.create(AppModule);

  // 3. Configure Express Middlewares
  app.enableCors();
  
  // Serve static files (uploads)
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  const port = process.env.PORT || 1234;
  await app.listen(port);
  logger.log(`✅ NestJS backend running on http://localhost:${port}`);
  logger.log(`✅ CRDT WebSocket Server running on ws://localhost:1235`);
}
bootstrap();
