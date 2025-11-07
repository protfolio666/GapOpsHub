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
  id: string;
  title: string;
  confidence: number;
  link: string;
}

interface AISuggestionPanelProps {
  similarGaps: SimilarGap[];
  suggestedSOP?: SOPSuggestion;
  onApplySOP?: () => void;
  onViewGap?: (id: string) => void;
}

export default function AISuggestionPanel({ similarGaps, suggestedSOP, onApplySOP, onViewGap }: AISuggestionPanelProps) {
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

        {suggestedSOP && (
          <div>
            <h4 className="text-sm font-medium mb-2">Suggested SOP</h4>
            <div className="p-4 rounded-md bg-primary/5 border border-primary/20">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <span className="font-mono text-xs text-muted-foreground">{suggestedSOP.id}</span>
                  <h5 className="text-sm font-medium mt-1">{suggestedSOP.title}</h5>
                </div>
                <Badge className="bg-primary text-primary-foreground">
                  {suggestedSOP.confidence}% confidence
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={onApplySOP} data-testid="button-apply-sop">
                  Apply SOP
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={suggestedSOP.link} target="_blank" rel="noopener noreferrer" data-testid="link-view-sop">
                    View <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
