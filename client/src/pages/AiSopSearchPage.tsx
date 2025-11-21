import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Send, BookOpen, AlertCircle } from "lucide-react";

interface SopRecommendation {
  sopId: string;
  title: string;
  relevance: number;
  content: string;
  reasoning: string;
}

interface SearchResponse {
  recommendations: SopRecommendation[];
  reasoning: string;
}

export default function AiSopSearchPage() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);

  const searchMutation = useMutation({
    mutationFn: (question: string) => 
      apiRequest("POST", "/api/sops/ai-search", { question }),
    onSuccess: (data: SearchResponse) => {
      setResults(data);
    },
    onError: (error: any) => {
      console.error("AI search error:", error);
      toast({ 
        title: "Search failed", 
        description: error?.message || "Could not search SOPs",
        variant: "destructive" 
      });
    },
  });

  const handleSearch = () => {
    if (!query.trim()) {
      toast({ title: "Please enter your issue or question", variant: "destructive" });
      return;
    }
    searchMutation.mutate(query);
  };

  const getRelevanceColor = (relevance: number) => {
    if (relevance >= 80) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100";
    if (relevance >= 60) return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100";
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI-Powered SOP Search</h1>
        <p className="text-muted-foreground">Describe your issue and we'll suggest relevant standard operating procedures</p>
      </div>

      <Card className="p-6 space-y-4">
        <div>
          <label className="text-sm font-medium block mb-2">Describe Your Issue or Question</label>
          <Textarea
            placeholder="Example: 'How do I handle customer complaints?' or 'Process for emergency procedures'"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-32"
            data-testid="textarea-ai-search"
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleSearch}
            disabled={searchMutation.isPending || !query.trim()}
            className="gap-2"
            data-testid="button-search-sops"
          >
            {searchMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Search SOPs
              </>
            )}
          </Button>
        </div>
      </Card>

      {results && (
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900 dark:text-blue-100">AI Analysis</p>
                <p className="text-sm text-blue-700 dark:text-blue-200 mt-1">{results.reasoning}</p>
              </div>
            </div>
          </div>

          {results.recommendations.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No matching SOPs found. Try rephrasing your question.</p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {results.recommendations.map((sop, idx) => (
                <Card key={idx} className="p-6 space-y-3" data-testid={`sop-recommendation-${idx}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{sop.title}</h3>
                        <Badge variant="outline" className="text-xs shrink-0">{sop.sopId}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Match Score:</span>
                        <div className={`text-xs px-2 py-1 rounded-full font-medium ${getRelevanceColor(sop.relevance)}`}>
                          {sop.relevance}%
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-3">
                      <strong>Why this SOP:</strong> {sop.reasoning}
                    </p>
                    <div className="border-t pt-3 mt-3">
                      <p className="text-sm font-medium mb-2">Relevant Section:</p>
                      <p className="text-sm line-clamp-3 text-muted-foreground">{sop.content.substring(0, 300)}...</p>
                    </div>
                  </div>

                  <Button variant="outline" size="sm" className="w-full" data-testid={`view-full-sop-${idx}`}>
                    View Full SOP
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {!results && (
        <Card className="p-8 text-center text-muted-foreground">
          <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Start typing your question above to find relevant SOPs</p>
        </Card>
      )}
    </div>
  );
}
