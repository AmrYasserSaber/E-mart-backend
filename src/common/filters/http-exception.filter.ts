import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status = exception.getStatus?.() ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const resBody = exception.getResponse?.();

    response.status(status).json({
      statusCode: status,
      message:
        typeof resBody === 'string'
          ? resBody
          : ((resBody as any)?.message ?? exception.message),
      error: (resBody as any)?.error,
      timestamp: new Date().toISOString(),
    });
  }
}
