import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, Search, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface SopItem {
  id: number;
  sopId: string;
  title: string;
  description?: string;
  content: string;
  parentSopId?: number;
  active: boolean;
  createdAt: string;
}

interface HierarchicalSop extends SopItem {
  children: HierarchicalSop[];
}

export default function SopBrowserPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSops, setExpandedSops] = useState<Set<number>>(new Set());
  const [selectedSop, setSelectedSop] = useState<SopItem | null>(null);

  const { data: sopsResponse, isLoading, isError } = useQuery({
    queryKey: ["/api/sops"],
    queryFn: () => apiRequest("/api/sops", { method: "GET" }) as Promise<{ sops: SopItem[] }>,
  });

  const { data: searchResults, isFetching: isSearching } = useQuery({
    queryKey: ["/api/sops/search", searchQuery],
    queryFn: () => apiRequest("/api/sops/search", { method: "POST", body: { query: searchQuery } }),
    enabled: searchQuery.trim().length > 0,
  });

  // Build hierarchical structure
  const hierarchicalSops = useMemo(() => {
    if (!sopsResponse?.sops) return [];

    const sopMap = new Map<number, HierarchicalSop>();
    const rootSops: HierarchicalSop[] = [];

    // First pass: create all items
    sopsResponse.sops.forEach((sop) => {
      sopMap.set(sop.id, { ...sop, children: [] });
    });

    // Second pass: build hierarchy
    sopsResponse.sops.forEach((sop) => {
      const hierarchicalSop = sopMap.get(sop.id)!;
      if (sop.parentSopId) {
        const parent = sopMap.get(sop.parentSopId);
        if (parent) {
          parent.children.push(hierarchicalSop);
        }
      } else {
        rootSops.push(hierarchicalSop);
      }
    });

    return rootSops;
  }, [sopsResponse?.sops]);

  const toggleExpand = (sopId: number) => {
    const newExpanded = new Set(expandedSops);
    if (newExpanded.has(sopId)) {
      newExpanded.delete(sopId);
    } else {
      newExpanded.add(sopId);
    }
    setExpandedSops(newExpanded);
  };

  const SopTreeNode = ({ sop, level = 0 }: { sop: HierarchicalSop; level?: number }) => {
    const hasChildren = sop.children.length > 0;
    const isExpanded = expandedSops.has(sop.id);
    const isSelected = selectedSop?.id === sop.id;

    return (
      <div key={sop.id}>
        <div
          className={`flex items-center gap-2 px-3 py-2 cursor-pointer rounded-md ${
            isSelected ? "bg-accent" : "hover-elevate"
          }`}
          style={{ marginLeft: `${level * 16}px` }}
          onClick={() => {
            if (hasChildren) {
              toggleExpand(sop.id);
            }
            setSelectedSop(sop);
          }}
          data-testid={`sop-node-${sop.id}`}
        >
          {hasChildren && (
            <ChevronRight
              className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
              data-testid={`chevron-${sop.id}`}
            />
          )}
          {!hasChildren && <div className="w-4" />}
          <span className="text-sm font-medium flex-1">{sop.title}</span>
        </div>

        {isExpanded && hasChildren && (
          <div>
            {sop.children.map((child) => (
              <SopTreeNode key={child.id} sop={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const displaySops = searchQuery.trim().length > 0 ? (searchResults?.sops || []) : hierarchicalSops;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center text-destructive">
        <p>Failed to load SOPs</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <div>
        <h1 className="text-3xl font-bold mb-2">SOP Library</h1>
        <p className="text-muted-foreground">Browse and reference standard operating procedures</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search SOPs by title, description, or content..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          data-testid="input-sop-search"
        />
        {isSearching && <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin" />}
      </div>

      <div className="flex gap-6 flex-1 overflow-hidden">
        {/* Left sidebar - SOP tree */}
        <Card className="w-64 p-4 overflow-y-auto">
          <div className="space-y-1">
            {displaySops.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">No SOPs found</p>
            ) : displaySops.map((sop) => (
              <SopTreeNode key={sop.id} sop={sop as HierarchicalSop} />
            ))}
          </div>
        </Card>

        {/* Right panel - SOP content */}
        <Card className="flex-1 p-6 overflow-y-auto">
          {selectedSop ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold">{selectedSop.title}</h2>
                    <p className="text-sm text-muted-foreground">ID: {selectedSop.sopId}</p>
                  </div>
                </div>
                {selectedSop.description && (
                  <p className="text-sm text-muted-foreground mt-2">{selectedSop.description}</p>
                )}
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Procedure</h3>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{selectedSop.content}</p>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button size="sm" variant="outline" data-testid="button-print-sop">
                  Print
                </Button>
                <Button size="sm" variant="outline" data-testid="button-share-sop">
                  Share
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-center text-muted-foreground">
              <div>
                <p>Select a SOP from the list to view details</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
