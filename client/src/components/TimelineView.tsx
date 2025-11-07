import { CheckCircle2, Circle } from "lucide-react";
import { format } from "date-fns";

interface TimelineEvent {
  title: string;
  timestamp: Date;
  completed: boolean;
}

interface TimelineViewProps {
  events: TimelineEvent[];
}

export default function TimelineView({ events }: TimelineViewProps) {
  return (
    <div className="space-y-4" data-testid="timeline-events">
      {events.map((event, index) => (
        <div key={index} className="flex gap-3">
          <div className="flex flex-col items-center">
            {event.completed ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground" />
            )}
            {index < events.length - 1 && (
              <div className={`w-0.5 h-12 ${event.completed ? "bg-green-600" : "bg-border"}`} />
            )}
          </div>
          <div className="flex-1 pb-4">
            <p className={`text-sm font-medium ${event.completed ? "text-foreground" : "text-muted-foreground"}`}>
              {event.title}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {format(event.timestamp, "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
