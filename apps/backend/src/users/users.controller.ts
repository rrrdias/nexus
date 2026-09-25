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
import { UsersService } from './users.service';
import { RequireAdmin } from '../auth/rbac.decorators';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ToggleUserActiveDto } from './dto/toggle-active.dto';

@RequireAdmin()
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
  createUser(@Req() req: any, @Body() data: CreateUserDto) {
    return this.usersService.createUser(req.user, data);
  }

  @Put(':id')
  updateUser(
    @Req() req: any,
    @Param('id') id: string,
    @Body() data: UpdateUserDto,
  ) {
    return this.usersService.updateUser(req.user, id, data);
  }

  @Put(':id/active')
  toggleUserActive(
    @Req() req: any,
    @Param('id') id: string,
    @Body() data: ToggleUserActiveDto,
  ) {
    return this.usersService.toggleUserActive(req.user, id, data.isActive);
  }

  @Delete(':id')
  deleteUser(@Req() req: any, @Param('id') id: string) {
    return this.usersService.deleteUser(req.user, id);
  }
}
