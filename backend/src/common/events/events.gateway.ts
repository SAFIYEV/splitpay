import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';

const JOIN_PREFIX = 'join:group:';
const LEAVE_PREFIX = 'leave:group:';

@WebSocketGateway({ cors: true })
export class EventsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly prisma: PrismaService) {}

  handleConnection(client: Socket) {
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
    const userId = client.handshake.auth?.userId as string | undefined;
    // TODO: replace userId handshake auth with JWT verification on the socket
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
