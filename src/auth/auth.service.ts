import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { buildAuthUser } from '../common/utils/role.util';
import { UsersService } from '../users/users.service';
import { RegisterBuyerDto } from './dto/register-buyer.dto';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async registerBuyer(dto: RegisterBuyerDto) {
    const user = await this.users.registerBuyer(dto.phone, dto.name);

    return {
      message: 'Registration successful. Please log in to continue.',
      user: buildAuthUser(user),
    };
  }

  async login(phone: string, code: string) {
    this.assertDevCode(code);

    const user = await this.users.findByPhone(phone);

    if (!user) {
      throw new UnauthorizedException('User is not registered');
    }

    const payload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
    };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.getTokenExpiry('JWT_ACCESS_EXPIRES_IN'),
    });

    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.getTokenExpiry('JWT_REFRESH_EXPIRES_IN'),
    });

    await this.users.updateRefreshToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      user: buildAuthUser(user),
    };
  }

  async refresh(userId: string, refreshToken: string) {
    const user = await this.users.findById(userId);

    if (!user || user.refreshToken !== refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.login(user.phone, this.getConfiguredDevCode());
  }

  async getMe(userId: string) {
    const user = await this.users.getProfileById(userId);
    return buildAuthUser(user);
  }

  private assertDevCode(code: string) {
    if (code !== this.getConfiguredDevCode()) {
      throw new UnauthorizedException('Invalid code');
    }
  }

  private getConfiguredDevCode() {
    return this.config.get<string>('AUTH_DEV_CODE') || '123456';
  }

  private getTokenExpiry(key: string): StringValue {
    return this.config.getOrThrow<string>(key) as StringValue;
  }
}
