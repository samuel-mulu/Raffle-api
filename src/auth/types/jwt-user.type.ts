import { Role } from '@prisma/client';
import type { Request } from 'express';

export type JwtUser = {
  sub: string;
  phone: string;
  role: Role;
};

export type AuthenticatedRequest = Request & {
  user: JwtUser;
};
