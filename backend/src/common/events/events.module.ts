import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { EventsGateway } from './events.gateway';
import { EventsService } from './events.service';

@Global()
@Module({
  imports: [
    // Same JWT configuration as AuthModule: the gateway verifies access
    // tokens on socket connections.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  providers: [EventsGateway, EventsService],
  exports: [EventsService],
})
export class EventsModule {}
