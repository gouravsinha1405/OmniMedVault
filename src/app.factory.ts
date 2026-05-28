import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Express, Request, Response } from 'express';
import { existsSync } from 'fs';
import { join } from 'path';

import { AppModule } from './app.module';

export async function createApp(expressApp?: Express) {
  const app = expressApp
    ? await NestFactory.create(AppModule, new ExpressAdapter(expressApp))
    : await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const httpAdapter = app.getHttpAdapter().getInstance();
  const builtPublicDir = join(__dirname, 'public');
  const sourcePublicDir = join(process.cwd(), 'public');
  const publicDir = existsSync(builtPublicDir) ? builtPublicDir : sourcePublicDir;

  httpAdapter.get('/', (_request: Request, response: Response) => {
    response.redirect('/demo');
  });

  httpAdapter.get('/demo', (_request: Request, response: Response) => {
    response.sendFile(join(publicDir, 'demo.html'));
  });

  await app.init();

  return app;
}

