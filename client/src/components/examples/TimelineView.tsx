import TimelineView from "../TimelineView";

export default function TimelineViewExample() {
  const events = [
    {
      title: "Gap Created",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72),
      completed: true,
    },
    {
      title: "AI Review Completed",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 71),
      completed: true,
    },
    {
      title: "Assigned to POC",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48),
      completed: true,
    },
    {
      title: "In Progress",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
      completed: true,
    },
    {
      title: "Resolved",
      timestamp: new Date(),
      completed: false,
    },
  ];

  return (
    <div className="p-4 max-w-md">
      <TimelineView events={events} />
    </div>
  );
}
