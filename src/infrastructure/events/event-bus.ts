export type DomainEvent = {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  organizationId: string;
  occurredAt: string;
  version: number;
  payload: Record<string, unknown>;
};

type EventHandler = (event: DomainEvent) => Promise<void>;

class EventBus {
  private handlers = new Map<string, EventHandler[]>();

  subscribe(eventType: string, handler: EventHandler): void {
    const existing = this.handlers.get(eventType) ?? [];
    this.handlers.set(eventType, [...existing, handler]);
  }

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventType) ?? [];
    await Promise.all(handlers.map((h) => h(event)));
  }
}

// Singleton — one bus per server process
export const eventBus = new EventBus();
