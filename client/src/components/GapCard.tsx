import { Card, CardContent } from "@/components/ui/card";
import StatusBadge from "./StatusBadge";
import PriorityIndicator from "./PriorityIndicator";
import UserAvatar from "./UserAvatar";
import { formatDistanceToNow } from "date-fns";

type GapStatus = "PendingAI" | "NeedsReview" | "Assigned" | "InProgress" | "Resolved" | "Closed" | "Reopened" | "Overdue";
type Priority = "High" | "Medium" | "Low";

interface GapCardProps {
  id: string;
  title: string;
  description: string;
  status: GapStatus;
  priority: Priority;
  reporter: string;
  assignedTo?: string;
  createdAt: Date;
  onClick?: () => void;
}

export default function GapCard({ id, title, description, status, priority, reporter, assignedTo, createdAt, onClick }: GapCardProps) {
  return (
    <Card className="hover-elevate cursor-pointer" onClick={onClick} data-testid={`card-gap-${id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-xs font-medium text-muted-foreground">{id}</span>
              <StatusBadge status={status} />
              <PriorityIndicator priority={priority} />
            </div>
            <h3 className="text-base font-medium mb-1 truncate">{title}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <UserAvatar name={reporter} size="sm" />
                <span>{reporter}</span>
              </div>
              {assignedTo && (
                <>
                  <span>→</span>
                  <div className="flex items-center gap-1">
                    <UserAvatar name={assignedTo} size="sm" />
                    <span>{assignedTo}</span>
                  </div>
                </>
              )}
              <span className="ml-auto">{formatDistanceToNow(createdAt, { addSuffix: true })}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
