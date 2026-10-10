import { Injectable } from '@nestjs/common';
import { EventsGateway } from './events.gateway';

@Injectable()
export class EventsService {
  constructor(private readonly gateway: EventsGateway) {}

  /** Emits `group:{groupId}:{event}` to every socket in the group room (spec 4.2). */
  emitToGroup(groupId: string, event: string, payload: unknown) {
    const server = this.gateway.server;
    if (!server) {
      return;
    }
    server.to(this.gateway.room(groupId)).emit(`group:${groupId}:${event}`, payload);
  }

  expenseNew(groupId: string, payload: unknown) {
    this.emitToGroup(groupId, 'expense:new', payload);
  }

  expenseUpdated(groupId: string, payload: unknown) {
    this.emitToGroup(groupId, 'expense:updated', payload);
  }

  expenseDeleted(groupId: string, payload: unknown) {
    this.emitToGroup(groupId, 'expense:deleted', payload);
  }

  settlementNew(groupId: string, payload: unknown) {
    this.emitToGroup(groupId, 'settlement:new', payload);
  }

  settlementPaid(groupId: string, payload: unknown) {
    this.emitToGroup(groupId, 'settlement:paid', payload);
  }

  memberJoined(groupId: string, payload: unknown) {
    this.emitToGroup(groupId, 'member:joined', payload);
  }

  memberLeft(groupId: string, payload: unknown) {
    this.emitToGroup(groupId, 'member:left', payload);
  }
}
