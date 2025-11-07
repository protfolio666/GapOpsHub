import MetricCard from "../MetricCard";
import { FileText, AlertCircle, CheckCircle, Clock } from "lucide-react";

export default function MetricCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-4">
      <MetricCard title="Total Gaps" value={156} icon={FileText} trend={{ value: 12, isPositive: true }} />
      <MetricCard title="Pending Review" value={23} icon={AlertCircle} />
      <MetricCard title="Resolved This Week" value={45} icon={CheckCircle} trend={{ value: 8, isPositive: true }} />
      <MetricCard title="Overdue" value={7} icon={Clock} subtitle="Requires attention" />
    </div>
  );
}
