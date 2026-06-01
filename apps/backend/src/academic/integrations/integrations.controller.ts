import { Controller, Get, Post, Body, Query, HttpStatus, HttpException, MessageEvent } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { Subject, Observable } from 'rxjs';

@Controller('api/academic/integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get('status')
  async getStatus() {
    try {
      return {
        success: true,
        data: await this.integrationsService.getSyncedStats(),
      };
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('profiles')
  async getProfiles() {
    try {
      return {
        success: true,
        data: await this.integrationsService.getProfiles(),
      };
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('history')
  async getHistory() {
    try {
      return {
        success: true,
        data: await this.integrationsService.getJobHistory(),
      };
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('run')
  async runJob(
    @Body('profileName') profileName: string,
    @Body('jobName') jobName: string,
    @Body('type') type: 'sync' | 'down',
  ) {
    if (!profileName || !jobName) {
      throw new HttpException('profileName and jobName are required', HttpStatus.BAD_REQUEST);
    }

    // Run job in background to prevent request timeout, but return execution result
    // The client will poll or look at the history, or we can return a quick response
    const logLogs: string[] = [];
    const callback = (msg: string) => {
      console.log(`[NEXUS AVA JOB] ${msg}`);
      logLogs.push(msg);
    };

    try {
      const p = type === 'down' 
        ? this.integrationsService.runDownJob(profileName, jobName, callback)
        : this.integrationsService.runSyncJob(profileName, jobName, callback);

      // Run asynchronously in background, returning instant success trigger
      p.catch(err => {
        console.error(`NEXUS AVA JOB ${type} failed in background:`, err);
      });

      return {
        success: true,
        message: `Sincronização iniciada com sucesso em background.`,
      };
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
