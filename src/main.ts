import { createApp } from './app.factory';

async function bootstrap(): Promise<void> {
  const app = await createApp();

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
}

void bootstrap();

