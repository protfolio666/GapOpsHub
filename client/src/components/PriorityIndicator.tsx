import { AlertTriangle, Circle, Minus } from "lucide-react";

type Priority = "High" | "Medium" | "Low";

interface PriorityIndicatorProps {
  priority: Priority;
  showLabel?: boolean;
}

const priorityConfig = {
  High: { icon: AlertTriangle, color: "text-priority-high", label: "High" },
  Medium: { icon: Circle, color: "text-priority-medium", label: "Medium" },
  Low: { icon: Minus, color: "text-priority-low", label: "Low" },
};

export default function PriorityIndicator({ priority, showLabel = false }: PriorityIndicatorProps) {
  const config = priorityConfig[priority];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-1" data-testid={`priority-${priority.toLowerCase()}`}>
      <Icon className={`h-4 w-4 ${config.color}`} />
      {showLabel && <span className="text-xs font-medium text-muted-foreground">{config.label}</span>}
    </div>
  );
}
