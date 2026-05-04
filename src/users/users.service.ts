import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { normalizePhone } from '../common/utils/phone.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findByPhone(phone: string) {
    return this.prisma.user.findUnique({
      where: { phone: normalizePhone(phone) },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async getProfileById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        phone: true,
        role: true,
        name: true,
        bio: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateRefreshToken(userId: string, token: string | null) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: token },
    });
  }

  async registerBuyer(phone: string, name?: string) {
    return this.createUser({
      phone,
      role: Role.USER,
      name,
      actorId: null,
      auditAction: 'BUYER_REGISTERED',
    });
  }

  async createStaff(actorId: string, dto: CreateStaffUserDto) {
    return this.createUser({
      phone: dto.phone,
      role: dto.role,
      name: dto.name,
      bio: dto.bio,
      avatarUrl: dto.avatarUrl,
      actorId,
      auditAction: 'STAFF_ACCOUNT_CREATED',
    });
  }

  listUsers(role?: Role) {
    return this.prisma.user.findMany({
      where: role ? { role } : undefined,
      select: {
        id: true,
        phone: true,
        name: true,
        bio: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            campaigns: true,
            tickets: true,
            payments: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    });
  }

  private async createUser(input: {
    phone: string;
    role: Role;
    name?: string;
    bio?: string;
    avatarUrl?: string;
    actorId: string | null;
    auditAction: string;
  }) {
    try {
      const user = await this.prisma.user.create({
        data: {
          phone: normalizePhone(input.phone),
          role: input.role,
          name: input.name,
          bio: input.bio,
          avatarUrl: input.avatarUrl,
        },
      });

      await this.audit.log(
        input.actorId ?? user.id,
        input.auditAction,
        'User',
        user.id,
        {
          role: user.role,
          phone: user.phone,
        },
      );

      return user;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Phone number already exists');
      }

      throw error;
    }
  }
}
