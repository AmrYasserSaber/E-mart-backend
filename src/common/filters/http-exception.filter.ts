import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorResponseBody {
  message?: string | string[];
  error?: string;
  errors?: unknown;
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const status = exception.getStatus?.() ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const responseBody = exception.getResponse?.();
    const normalizedBody: ErrorResponseBody | undefined =
      typeof responseBody === 'object' && responseBody !== null
        ? (responseBody as ErrorResponseBody)
        : undefined;

    this.logger.error(
      `HTTP ${status} - ${request.method} ${request.url} - ${exception.message}`,
    );

    response.status(status).json({
      statusCode: status,
      message:
        typeof responseBody === 'string'
          ? responseBody
          : (normalizedBody?.message ?? exception.message),
      error: normalizedBody?.error,
      ...(normalizedBody?.errors !== undefined
        ? { errors: normalizedBody.errors }
        : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
