import { Controller, Post, Body, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { LoginDto } from './dto/login.dto';

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  signIn(@Body() signInDto: LoginDto, @Req() req: any = {}) {
    const identifier = (signInDto.email || signInDto.login || '').trim();
    const headers = req?.headers || {};
    const forwarded = headers['x-forwarded-for'];
    const ipAddress = (
      typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : req?.socket?.remoteAddress || req?.ip || ''
    ).replace('::ffff:', '');
    const userAgent = headers['user-agent']?.toString() || '';

    const context =
      ipAddress || userAgent ? { ipAddress, userAgent } : undefined;

    return context
      ? this.authService.login(identifier, signInDto.password, context)
      : this.authService.login(identifier, signInDto.password);
  }
}
