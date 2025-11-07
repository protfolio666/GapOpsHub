import CommentThread from "../CommentThread";

export default function CommentThreadExample() {
  const mockComments = [
    {
      id: "1",
      author: "Sarah Chen",
      content: "I've identified this gap during the Q4 refund audit. Affecting approximately 15% of all refund requests.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    },
    {
      id: "2",
      author: "Mike Torres",
      content: "Investigating now. Found the root cause - email notification service wasn't triggered in the refund workflow. Will implement fix by EOD.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
      attachments: ["refund_flow_diagram.pdf"],
    },
    {
      id: "3",
      author: "Lisa Park",
      content: "Please ensure the fix includes both automated and manual refund paths.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
    },
  ];

  return (
    <div className="p-4 max-w-2xl">
      <CommentThread
        comments={mockComments}
        onAddComment={(content) => console.log("New comment:", content)}
      />
    </div>
  );
}
