import { Role } from '@prisma/client';

type SessionUser = {
  id: string;
  phone: string;
  role: Role;
  name?: string | null;
  avatarUrl?: string | null;
};

export function getRoleLabel(role: Role): string {
  switch (role) {
    case Role.ADMIN:
      return 'Admin';
    case Role.CREATOR:
      return 'Creator';
    case Role.USER:
    default:
      return 'Buyer';
  }
}

export function getLandingPath(role: Role): string {
  switch (role) {
    case Role.ADMIN:
      return '/admin/overview';
    case Role.CREATOR:
      return '/creator/overview';
    case Role.USER:
    default:
      return '/buyer/campaigns';
  }
}

export function buildAuthUser(user: SessionUser) {
  return {
    id: user.id,
    phone: user.phone,
    role: user.role,
    roleLabel: getRoleLabel(user.role),
    landingPath: getLandingPath(user.role),
    name: user.name ?? null,
    avatarUrl: user.avatarUrl ?? null,
  };
}
