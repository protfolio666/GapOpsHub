import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SimilarGap {
  id: string;
  title: string;
  similarity: number;
}

interface SOPSuggestion {
  sopId: number;
  title: string;
  relevanceScore: number;
  reasoning: string;
}

interface AISuggestionPanelProps {
  similarGaps: SimilarGap[];
  suggestedSOPs?: SOPSuggestion[];
  onApplySOP?: (sopId: number) => void;
  onViewGap?: (id: string) => void;
}

export default function AISuggestionPanel({ similarGaps, suggestedSOPs, onApplySOP, onViewGap }: AISuggestionPanelProps) {
  return (
    <Card className="border-2 border-primary/20" data-testid="panel-ai-suggestions">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Suggestions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {similarGaps.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Similar Gaps</h4>
            <div className="space-y-2">
              {similarGaps.map((gap) => (
                <div
                  key={gap.id}
                  className="p-3 rounded-md bg-muted/50 hover-elevate cursor-pointer"
                  onClick={() => onViewGap?.(gap.id)}
                  data-testid={`similar-gap-${gap.id}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-xs text-muted-foreground">{gap.id}</span>
                      <p className="text-sm truncate">{gap.title}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {gap.similarity}% match
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {suggestedSOPs && suggestedSOPs.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Suggested SOPs</h4>
            <div className="space-y-2">
              {suggestedSOPs.map((sop) => (
                <div
                  key={sop.sopId}
                  className="p-3 rounded-md bg-primary/5 border border-primary/20"
                  data-testid={`suggested-sop-${sop.sopId}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-xs text-muted-foreground">SOP-{sop.sopId}</span>
                      <h5 className="text-sm font-medium mt-1">{sop.title}</h5>
                    </div>
                    <Badge className="bg-primary text-primary-foreground shrink-0">
                      {sop.relevanceScore}%
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{sop.reasoning}</p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => onApplySOP?.(sop.sopId)} data-testid={`button-apply-sop-${sop.sopId}`}>
                      Apply SOP
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={`/admin/sops/${sop.sopId}`} data-testid={`link-view-sop-${sop.sopId}`}>
                        View <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
