import { Controller, Get, Req } from '@nestjs/common';
import { SystemService } from './system.service';
import { RequireAdmin } from '../auth/rbac.decorators';

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

  @RequireAdmin()
  @Get('admin-dashboard')
  getAdminDashboardStats(@Req() req: any) {
    this.systemService.recordUserActivity(req.user.id);
    return this.systemService.getSystemAdminDashboardStats();
  }
}
