import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from './jwt.guard';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterBuyerDto } from './dto/register-buyer.dto';
import type { JwtUser } from './types/jwt-user.type';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterBuyerDto) {
    return this.auth.registerBuyer(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto.phone, dto.code);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.userId, dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: JwtUser) {
    return this.auth.getMe(user.sub);
  }
}
