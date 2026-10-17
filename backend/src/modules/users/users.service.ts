import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// Public profiles never expose email: it stays available only via /auth/me.
const publicUserSelect = {
  id: true,
  displayName: true,
  avatar: true,
  walletAddress: true,
  verified: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: publicUserSelect,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  search(q: string) {
    // Minimum query length prevents enumerating the whole user base page by page.
    if (q.trim().length < 2) {
      return [];
    }
    return this.prisma.user.findMany({
      where: {
        OR: [
          { displayName: { contains: q, mode: 'insensitive' } },
          { walletAddress: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: publicUserSelect,
      take: 20,
    });
  }
}
