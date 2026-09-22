import { LoggingInterceptor } from './logging.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { Request, Response } from 'express';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let mockContext: ExecutionContext;
  let mockCallHandler: CallHandler;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    mockRequest = {
      method: 'GET',
      originalUrl: '/api/academic',
      ip: '127.0.0.1',
      requestId: 'test-req-id',
      headers: {},
    };
    mockResponse = {
      statusCode: 200,
    };
    mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest as Request,
        getResponse: () => mockResponse as Response,
      }),
    } as unknown as ExecutionContext;
  });

  it('should intercept successful calls and pass data through', (done) => {
    mockCallHandler = {
      handle: () => of({ success: true }),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: (result) => {
        expect(result).toEqual({ success: true });
        done();
      },
    });
  });

  it('should intercept errored calls and propagate error', (done) => {
    const error = new Error('Database error');
    mockCallHandler = {
      handle: () => throwError(() => error),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      error: (err) => {
        expect(err).toBe(error);
        done();
      },
    });
  });
});
