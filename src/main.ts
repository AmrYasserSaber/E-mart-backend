import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { configureNestJsTypebox } from 'nestjs-typebox';
import { env } from './config/env';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { Logger } from '@nestjs/common';

const logger = new Logger('MainModule');

configureNestJsTypebox({
  patchSwagger: true,
  setFormats: true,
});

/**
 * Bootstraps and starts the NestJS application, configuring security, CORS, validation, global filters/interceptors, and Swagger.
 *
 * Sets up Helmet security headers, enables CORS (allowing any origin and credentials), registers Swagger at `/swagger` with bearer auth, applies a ValidationPipe that whitelists and transforms inputs and forbids unknown properties, installs global HTTP exception filtering and a response interceptor, then listens on `env.PORT` and logs the application and documentation URLs.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.enableCors({
    origin: true,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('E-mart API')
    .setDescription('API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  await app.listen(env.PORT);

  logger.log(`App is running on http://localhost:${env.PORT}`);
  logger.log(
    `API documentation is available at http://localhost:${env.PORT}/swagger`,
  );
}
void bootstrap();
