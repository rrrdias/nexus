import { GlobalExceptionFilter } from './global-exception.filter';
import { HttpException, HttpStatus, NotFoundException, BadRequestException } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import { Request, Response } from 'express';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: Partial<Response>;
  let mockRequest: Partial<Request>;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest = {
      url: '/api/users/999',
      method: 'GET',
      headers: { 'x-request-id': 'req-test-123' },
      requestId: 'req-test-123',
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse as Response,
        getRequest: () => mockRequest as Request,
      }),
    } as unknown as ArgumentsHost;
  });

  it('should format HttpException correctly (404 NotFoundException)', () => {
    const exception = new NotFoundException('Usuário não encontrado.');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        message: 'Usuário não encontrado.',
        path: '/api/users/999',
        requestId: 'req-test-123',
        timestamp: expect.any(String),
      }),
    );
  });

  it('should handle validation errors with array of messages', () => {
    const exception = new BadRequestException(['Email inválido', 'Nome é obrigatório']);

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.BAD_REQUEST,
        message: ['Email inválido', 'Nome é obrigatório'],
      }),
    );
  });

  it('should handle generic Error and return 500 status', () => {
    const exception = new Error('Database query timeout');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Error',
      }),
    );
  });
});
