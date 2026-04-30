import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByPhone(phone: string) {
    return this.prisma.user.findUnique({
      where: { phone },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async create(phone: string) {
    return this.prisma.user.create({
      data: { phone },
    });
  }

  async updateRefreshToken(userId: string, token: string | null) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: token },
    });
  }
}
