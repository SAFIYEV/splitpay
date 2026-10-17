import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './common/events/redis-io.adapter';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Behind a reverse proxy (Render) req.ip is the proxy IP without this —
  // rate limiting would bucket all users together.
  const httpAdapter = app.getHttpAdapter().getInstance() as {
    set: (key: string, value: unknown) => void;
  };
  httpAdapter.set('trust proxy', 1);

  app.use(helmet());

  const corsOrigins = (config.get<string>('corsOrigin') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (corsOrigins.length > 0) {
    app.enableCors({ origin: corsOrigins });
  } else if (config.get<string>('nodeEnv') === 'production') {
    // Fail closed: no cross-origin browser access until CORS_ORIGIN is set.
    app.enableCors({ origin: false });
  } else {
    app.enableCors();
  }

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const redisAdapter = new RedisIoAdapter(
    app,
    config.get<string>('redisUrl') ?? 'redis://localhost:6379',
    corsOrigins,
  );
  await redisAdapter.connectToRedis();
  app.useWebSocketAdapter(redisAdapter);

  await app.listen(config.get<number>('port') ?? 3000);
}
void bootstrap();
