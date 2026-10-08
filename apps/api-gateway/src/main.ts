import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Веб-интерфейс (Next.js на :3001) ходит в API напрямую из браузера.
  // Для локального демо разрешаем любой origin; в проде здесь был бы список доменов.
  app.enableCors({ origin: true });
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  Logger.log(`HTTP gateway: http://localhost:${port}`, 'Bootstrap');
}
bootstrap();
