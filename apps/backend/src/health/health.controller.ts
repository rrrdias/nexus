import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { HealthService } from './health.service';
import { Public } from '../auth/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  async check(@Res() res: Response) {
    const result = await this.healthService.checkHealth();
    const httpStatus =
      result.status === 'error'
        ? HttpStatus.SERVICE_UNAVAILABLE
        : HttpStatus.OK;

    return res.status(httpStatus).json(result);
  }
}
