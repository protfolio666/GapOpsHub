import AISuggestionPanel from "../AISuggestionPanel";

export default function AISuggestionPanelExample() {
  return (
    <div className="p-4 max-w-md">
      <AISuggestionPanel
        similarGaps={[
          { id: "GAP-1145", title: "Refund process automation missing", similarity: 87 },
          { id: "GAP-0892", title: "Customer notification gaps in refunds", similarity: 78 },
          { id: "GAP-0654", title: "Manual refund workflow issues", similarity: 65 },
        ]}
        suggestedSOP={{
          id: "SOP-21",
          title: "Standard Refund Processing Procedure",
          confidence: 92,
          link: "#",
        }}
        onApplySOP={() => console.log("Apply SOP clicked")}
        onViewGap={(id) => console.log("View gap:", id)}
      />
    </div>
  );
}
