import { Badge } from "@/components/ui/badge";

type GapStatus = "PendingAI" | "NeedsReview" | "Assigned" | "InProgress" | "Resolved" | "Closed" | "Reopened" | "Overdue";

interface StatusBadgeProps {
  status: GapStatus;
}

const statusConfig = {
  PendingAI: { label: "Pending AI", className: "bg-status-pending text-white" },
  NeedsReview: { label: "Needs Review", className: "bg-status-pending text-white" },
  Assigned: { label: "Assigned", className: "bg-status-assigned text-white" },
  InProgress: { label: "In Progress", className: "bg-status-inprogress text-white" },
  Overdue: { label: "Overdue", className: "bg-status-overdue text-white animate-pulse" },
  Resolved: { label: "Resolved", className: "bg-status-resolved text-white" },
  Closed: { label: "Closed", className: "border border-status-closed text-status-closed bg-transparent" },
  Reopened: { label: "Reopened", className: "bg-status-overdue text-white" },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge className={`rounded-full px-3 py-1 text-xs font-medium ${config.className}`} data-testid={`badge-status-${status.toLowerCase()}`}>
      {config.label}
    </Badge>
  );
}
