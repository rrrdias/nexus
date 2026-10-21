import { Controller, Get, Post, Query, Body, Req } from '@nestjs/common';
import { AuditService } from './audit.service';
import { RequireAdmin } from '../auth/rbac.decorators';
import { AuditQueryDto, ExportAuditQueryDto } from './dto/audit-query.dto';

@RequireAdmin()
@Controller('api/audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async getLogs(@Query() query: AuditQueryDto) {
    return this.auditService.findAll(query);
  }

  @Get('stats')
  async getStats() {
    return this.auditService.getStats();
  }

  @Post('export')
  async exportLogs(@Body() dto: ExportAuditQueryDto) {
    return this.auditService.exportData(dto);
  }
}
