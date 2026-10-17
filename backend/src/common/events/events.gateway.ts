import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { JwtPayload } from '../../modules/auth/strategies/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';

const JOIN_PREFIX = 'join:group:';
const LEAVE_PREFIX = 'leave:group:';

// CORS is configured on the Socket.io server level (RedisIoAdapter), not here.
@WebSocketGateway()
export class EventsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    // The socket is useless without a verified JWT: the user id always comes
    // from the token, never from client-supplied handshake fields.
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) {
        throw new Error('missing token');
      }
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('jwt.secret'),
        algorithms: ['HS256'],
      });
      if (payload.type !== 'access') {
        throw new Error('wrong token type');
      }
      client.data.userId = payload.sub;
    } catch {
      this.logger.debug('WS client rejected: invalid auth token');
      client.disconnect(true);
      return;
    }

    // Spec 4.2: clients subscribe with `join:group:{groupId}` / `leave:group:{groupId}`
    client.onAny((event: string) => {
      if (event.startsWith(JOIN_PREFIX)) {
        const groupId = event.slice(JOIN_PREFIX.length);
        void this.handleJoin(client, groupId);
      } else if (event.startsWith(LEAVE_PREFIX)) {
        const groupId = event.slice(LEAVE_PREFIX.length);
        void client.leave(this.room(groupId));
      }
    });
  }

  private async handleJoin(client: Socket, groupId: string) {
    const userId = client.data.userId as string | undefined;
    if (!userId) {
      return;
    }
    const membership = await this.prisma.groupMember
      .findUnique({
        where: { groupId_userId: { groupId, userId } },
      })
      .catch(() => null);
    if (membership) {
      await client.join(this.room(groupId));
    }
  }

  room(groupId: string): string {
    return `group:${groupId}`;
  }
}
