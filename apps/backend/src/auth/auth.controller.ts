import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { Throttle } from '@nestjs/throttler';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Throttle({ default: { limit: 10, ttl: 60000 } })
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

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: any = {}) {
    const headers = req?.headers || {};
    const forwarded = headers['x-forwarded-for'];
    const ipAddress = (
      typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : req?.socket?.remoteAddress || req?.ip || ''
    ).replace('::ffff:', '');
    const userAgent = headers['user-agent']?.toString() || '';
    const originUrl =
      dto.originUrl ||
      headers['x-client-origin']?.toString() ||
      headers['origin']?.toString() ||
      '';

    return this.authService.forgotPassword(dto.login, {
      ipAddress,
      userAgent,
      originUrl,
    });
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto, @Req() req: any = {}) {
    const headers = req?.headers || {};
    const forwarded = headers['x-forwarded-for'];
    const ipAddress = (
      typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : req?.socket?.remoteAddress || req?.ip || ''
    ).replace('::ffff:', '');
    const userAgent = headers['user-agent']?.toString() || '';

    const newPassword = dto.newPassword || dto.newPass || '';

    return this.authService.resetPassword(dto.token, newPassword, {
      ipAddress,
      userAgent,
    });
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Req() req: any = {}) {
    const userId = req?.user?.id || req?.user?.sub || '';
    return this.authService.refreshToken(userId);
  }
}
