import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { HttpStatus } from '@nestjs/common';
import { Response } from 'express';

describe('HealthController', () => {
  let controller: HealthController;
  let mockHealthService: any;
  let mockResponse: Partial<Response>;

  beforeEach(async () => {
    mockHealthService = {
      checkHealth: jest.fn(),
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: mockHealthService }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should return 200 OK when health status is ok or degraded', async () => {
    mockHealthService.checkHealth.mockResolvedValueOnce({
      status: 'ok',
      services: { database: { status: 'up' } },
    });

    await controller.check(mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ok' }),
    );
  });

  it('should return 503 SERVICE_UNAVAILABLE when health status is error', async () => {
    mockHealthService.checkHealth.mockResolvedValueOnce({
      status: 'error',
      services: { database: { status: 'down' } },
    });

    await controller.check(mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error' }),
    );
  });
});
