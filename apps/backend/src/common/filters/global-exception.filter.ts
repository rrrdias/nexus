import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isProduction = process.env.NODE_ENV === 'production';
    const requestId = request.requestId || (request.headers['x-request-id'] as string) || '-';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorTitle = 'Internal Server Error';
    let message: string | string[] = 'Ocorreu um erro interno no servidor.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, any>;
        message = resObj.message || exception.message;
        errorTitle = resObj.error || exception.name;
      } else if (typeof res === 'string') {
        message = res;
        errorTitle = exception.name;
      } else {
        message = exception.message;
        errorTitle = exception.name;
      }
    } else if (exception instanceof Error) {
      errorTitle = exception.name || 'Internal Server Error';
      message = isProduction
        ? 'Ocorreu um erro interno no servidor. Por favor, tente novamente mais tarde.'
        : exception.message || 'Erro inesperado.';
    }

    const errorPayload = {
      success: false,
      statusCode: status,
      error: errorTitle,
      message,
      timestamp: new Date().toISOString(),
      path: request.originalUrl || request.url,
      requestId,
    };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} - ${status} ${errorTitle}: ${JSON.stringify(message)}`,
        stack,
      );
    } else {
      this.logger.warn(
        `[${requestId}] ${request.method} ${request.url} - ${status} ${errorTitle}: ${JSON.stringify(message)}`,
      );
    }

    // Retorna a resposta padronizada
    response.status(status).json(errorPayload);
  }
}
