import PriorityIndicator from "../PriorityIndicator";

export default function PriorityIndicatorExample() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex gap-4">
        <PriorityIndicator priority="High" />
        <PriorityIndicator priority="Medium" />
        <PriorityIndicator priority="Low" />
      </div>
      <div className="flex gap-4">
        <PriorityIndicator priority="High" showLabel />
        <PriorityIndicator priority="Medium" showLabel />
        <PriorityIndicator priority="Low" showLabel />
      </div>
    </div>
  );
}
