import { Controller, Get, Req } from '@nestjs/common';
import { SystemService } from './system.service';

@Controller('api/system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('modules')
  getAllModules() {
    return this.systemService.getAllModules();
  }

  @Get('sidebar-modules')
  getSidebarModules(@Req() req: any) {
    this.systemService.recordUserActivity(req.user.id);
    return this.systemService.getSidebarModules(req.user.id);
  }

  @Get('admin-dashboard')
  getAdminDashboardStats(@Req() req: any) {
    this.systemService.recordUserActivity(req.user.id);
    return this.systemService.getSystemAdminDashboardStats();
  }
}
