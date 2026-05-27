import { Controller, Get, Post, Put, Delete, Body, Param, Req } from '@nestjs/common';
import { GroupsService } from './groups.service';

@Controller('api/groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  getGroups(@Req() req: any) {
    return this.groupsService.getGroups(req.user);
  }

  @Get(':id')
  getGroupWithModules(@Req() req: any, @Param('id') id: string) {
    return this.groupsService.getGroupWithModules(req.user, id);
  }

  @Post()
  createGroup(
    @Req() req: any,
    @Body('name') name: string,
    @Body('description') description: string,
    @Body('moduleIds') moduleIds: string[]
  ) {
    return this.groupsService.createGroup(req.user, name, description, moduleIds);
  }

  @Put(':id')
  updateGroup(
    @Req() req: any,
    @Param('id') id: string,
    @Body('name') name: string,
    @Body('description') description: string,
    @Body('moduleIds') moduleIds: string[]
  ) {
    return this.groupsService.updateGroup(req.user, id, name, description, moduleIds);
  }

  @Delete(':id')
  deleteGroup(@Req() req: any, @Param('id') id: string) {
    return this.groupsService.deleteGroup(req.user, id);
  }
}
