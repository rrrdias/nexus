import { Controller, Get, Post, Put, Delete, Body, Param, Req } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getUsers(@Req() req: any) {
    return this.usersService.getUsers(req.user);
  }

  @Get(':id')
  getUserForEdit(@Req() req: any, @Param('id') id: string) {
    return this.usersService.getUserForEdit(req.user, id);
  }

  @Post()
  createUser(@Req() req: any, @Body() data: any) {
    return this.usersService.createUser(req.user, data);
  }

  @Put(':id')
  updateUser(@Req() req: any, @Param('id') id: string, @Body() data: any) {
    return this.usersService.updateUser(req.user, id, data);
  }

  @Put(':id/active')
  toggleUserActive(@Req() req: any, @Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.usersService.toggleUserActive(req.user, id, isActive);
  }

  @Delete(':id')
  deleteUser(@Req() req: any, @Param('id') id: string) {
    return this.usersService.deleteUser(req.user, id);
  }
}
