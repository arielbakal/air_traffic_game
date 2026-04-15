import type { GameEvent } from "../../core/types";

interface EventLogProps {
  events: GameEvent[];
}

function formatEventTime(timestamp: number): string {
  const total = Math.max(0, Math.floor(timestamp));
  const h = Math.floor(total / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((total % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(total % 60)
    .toString()
    .padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function EventLog({ events }: EventLogProps) {
  return (
    <div className="panel event-log">
      <h3>Event Log</h3>
      <div className="event-list">
        {events.map((event, index) => (
          <div key={`${event.timestamp}-${index}`} className={`event-item ${event.severity}`}>
            <span className="event-time">[{formatEventTime(event.timestamp)}]</span>
            <span>{event.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
