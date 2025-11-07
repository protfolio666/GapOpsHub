import StatusBadge from "../StatusBadge";

export default function StatusBadgeExample() {
  return (
    <div className="flex flex-wrap gap-2 p-4">
      <StatusBadge status="PendingAI" />
      <StatusBadge status="NeedsReview" />
      <StatusBadge status="Assigned" />
      <StatusBadge status="InProgress" />
      <StatusBadge status="Overdue" />
      <StatusBadge status="Resolved" />
      <StatusBadge status="Closed" />
      <StatusBadge status="Reopened" />
    </div>
  );
}
