import { EventEmitter } from "events";

export type LiveEvent = {
  type:
    | "TEAM_LOGIN"
    | "TEAM_LOGOUT"
    | "QUIZ_STARTED"
    | "ANSWER_SAVED"
    | "QUIZ_SUBMITTED"
    | "MALPRACTICE"
    | "TERMINATED"
    | "SETTINGS_UPDATED"
    | "TEAM_UPDATED"
    | "TEAM_DELETED"
    | "HEARTBEAT";
  teamId?: number;
  teamCode?: string;
  teamName?: string;
  round?: number;
  message?: string;
  data?: Record<string, unknown>;
  at: string;
};

const globalForEvents = globalThis as typeof globalThis & {
  __outputHuntBus?: EventEmitter;
};

export const eventBus =
  globalForEvents.__outputHuntBus ??
  (() => {
    const bus = new EventEmitter();
    bus.setMaxListeners(500);
    return bus;
  })();

if (process.env.NODE_ENV !== "production") {
  globalForEvents.__outputHuntBus = eventBus;
}

export function broadcast(event: Omit<LiveEvent, "at">) {
  const payload: LiveEvent = { ...event, at: new Date().toISOString() };
  eventBus.emit("live", payload);
}

export function subscribe(listener: (event: LiveEvent) => void) {
  eventBus.on("live", listener);
  return () => eventBus.off("live", listener);
}
