import GapCard from "../GapCard";

export default function GapCardExample() {
  return (
    <div className="flex flex-col gap-4 p-4 max-w-2xl">
      <GapCard
        id="GAP-1234"
        title="Refund process missing customer notification"
        description="When processing refunds, customers are not receiving email confirmations, leading to multiple support tickets asking about refund status."
        status="Overdue"
        priority="High"
        reporter="Sarah Chen"
        assignedTo="Mike Torres"
        createdAt={new Date(Date.now() - 1000 * 60 * 60 * 48)}
        onClick={() => console.log("Gap clicked")}
      />
      <GapCard
        id="GAP-1235"
        title="Onboarding checklist incomplete for enterprise customers"
        description="Enterprise customers skip critical security training steps during onboarding."
        status="InProgress"
        priority="Medium"
        reporter="James Wilson"
        assignedTo="Lisa Park"
        createdAt={new Date(Date.now() - 1000 * 60 * 60 * 12)}
        onClick={() => console.log("Gap clicked")}
      />
    </div>
  );
}
