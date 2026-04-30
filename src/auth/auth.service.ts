import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async validateOrCreateUser(phone: string) {
    let user = await this.users.findByPhone(phone);

    if (!user) {
      user = await this.users.create(phone);
    }

    return user;
  }

  async login(phone: string) {
    const user = await this.validateOrCreateUser(phone);

    const payload = {
      sub: user.id,
      phone: user.phone,
      role: (user as any).role,
    };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN') as any,
    });

    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN') as any,
    });

    await this.users.updateRefreshToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      user,
    };
  }

  async refresh(userId: string, refreshToken: string) {
    const user = await this.users.findById(userId);

    if (!user || (user as any).refreshToken !== refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.login(user.phone);
  }
}
