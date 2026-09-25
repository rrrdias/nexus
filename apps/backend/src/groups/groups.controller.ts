import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { RequireAdmin } from '../auth/rbac.decorators';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

@RequireAdmin()
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
  createGroup(@Req() req: any, @Body() data: CreateGroupDto) {
    return this.groupsService.createGroup(
      req.user,
      data.name,
      data.description || '',
      data.moduleIds || [],
    );
  }

  @Put(':id')
  updateGroup(
    @Req() req: any,
    @Param('id') id: string,
    @Body() data: UpdateGroupDto,
  ) {
    return this.groupsService.updateGroup(
      req.user,
      id,
      data.name,
      data.description || '',
      data.moduleIds || [],
    );
  }

  @Delete(':id')
  deleteGroup(@Req() req: any, @Param('id') id: string) {
    return this.groupsService.deleteGroup(req.user, id);
  }
}
