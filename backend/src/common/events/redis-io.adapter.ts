import { Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { ServerOptions } from 'socket.io';

/**
 * Socket.io adapter backed by Redis pub/sub so multiple backend instances
 * broadcast to the same group rooms. Falls back to the in-memory adapter
 * when Redis is unreachable.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly adapterLogger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | undefined;

  constructor(
    appOrHttpServer: unknown,
    private readonly redisUrl: string,
  ) {
    super(appOrHttpServer as never);
  }

  async connectToRedis(): Promise<void> {
    const pubClient = new Redis(this.redisUrl, { lazyConnect: true });
    const subClient = pubClient.duplicate();
    try {
      await Promise.all([pubClient.connect(), subClient.connect()]);
      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.adapterLogger.log('Socket.io Redis adapter connected');
    } catch (err) {
      this.adapterLogger.warn(
        `Redis adapter unavailable, using in-memory adapter: ${(err as Error).message}`,
      );
      pubClient.disconnect();
      subClient.disconnect();
    }
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options) as ReturnType<
      IoAdapter['createIOServer']
    > & { adapter: (a: unknown) => void };
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
