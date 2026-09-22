import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    const { method, originalUrl, ip } = request;
    const requestId = request.requestId || request.headers['x-request-id'] || '-';
    const user = (request as any).user;
    const userIdentifier = user?.email || user?.id || user?.sub || 'anonymous';

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;

          this.logger.log(
            `[${requestId}] ${method} ${originalUrl} ${statusCode} +${duration}ms - ${userIdentifier} (${ip})`,
          );
        },
        error: (err: any) => {
          const duration = Date.now() - startTime;
          const statusCode = err?.status || err?.statusCode || 500;

          this.logger.warn(
            `[${requestId}] ${method} ${originalUrl} ${statusCode} +${duration}ms - ${userIdentifier} (${ip}) - Error: ${err?.message || 'Unknown'}`,
          );
        },
      }),
    );
  }
}
