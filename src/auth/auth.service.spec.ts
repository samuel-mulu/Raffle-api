import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let users: {
    registerBuyer: jest.Mock;
    findByPhone: jest.Mock;
    updateRefreshToken: jest.Mock;
    findById: jest.Mock;
    getProfileById: jest.Mock;
  };

  beforeEach(async () => {
    users = {
      registerBuyer: jest.fn(),
      findByPhone: jest.fn(),
      updateRefreshToken: jest.fn(),
      findById: jest.fn(),
      getProfileById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: users,
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('signed-token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const values: Record<string, string> = {
                AUTH_DEV_CODE: '654321',
                JWT_ACCESS_SECRET: 'access',
                JWT_REFRESH_SECRET: 'refresh',
                JWT_ACCESS_EXPIRES_IN: '15m',
                JWT_REFRESH_EXPIRES_IN: '30d',
              };

              return values[key];
            }),
            getOrThrow: jest.fn((key: string) => {
              const values: Record<string, string> = {
                JWT_ACCESS_SECRET: 'access',
                JWT_REFRESH_SECRET: 'refresh',
                JWT_ACCESS_EXPIRES_IN: '15m',
                JWT_REFRESH_EXPIRES_IN: '30d',
              };

              return values[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('registers buyers with the buyer landing path', async () => {
    users.registerBuyer.mockResolvedValue({
      id: 'buyer-1',
      phone: '+251911000099',
      role: Role.USER,
      name: 'Buyer',
      avatarUrl: null,
    });

    const result = await service.registerBuyer({
      phone: '+251911000099',
      name: 'Buyer',
    });

    expect(result.user.roleLabel).toBe('Buyer');
    expect(result.user.landingPath).toBe('/buyer/campaigns');
  });

  it('rejects login for unknown phones', async () => {
    users.findByPhone.mockResolvedValue(null);

    await expect(
      service.login('+251911000099', '654321'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
