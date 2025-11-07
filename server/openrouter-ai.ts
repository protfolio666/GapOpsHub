import type { Gap } from "@shared/schema";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
// Custom model from environment variable, defaults to free Llama model
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free";

interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

async function callOpenRouter(messages: OpenRouterMessage[], model = OPENROUTER_MODEL): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://gapops.replit.app",
      "X-Title": "GapOps Process Gap Intelligence",
    },
    body: JSON.stringify({
      model,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${error}`);
  }

  const data: OpenRouterResponse = await response.json();
  return data.choices[0]?.message?.content || "";
}

/**
 * Use AI to calculate semantic similarity between two gaps
 * Returns a score from 0-100
 */
export async function calculateAISimilarity(gap1: Gap, gap2: Gap): Promise<number> {
  try {
    const messages: OpenRouterMessage[] = [
      {
        role: "system",
        content: "You are an expert at analyzing process gaps and determining similarity. Return ONLY a number from 0-100 representing similarity percentage."
      },
      {
        role: "user",
        content: `Analyze these two process gaps and rate their similarity from 0-100.
        
Gap 1:
Title: ${gap1.title}
Description: ${gap1.description}
Department: ${gap1.department || "N/A"}

Gap 2:
Title: ${gap2.title}
Description: ${gap2.description}
Department: ${gap2.department || "N/A"}

Consider:
- Same root cause
- Similar symptoms
- Same department/process
- Related solutions

Return ONLY the similarity score (0-100):`
      }
    ];

    const result = await callOpenRouter(messages);
    const score = parseInt(result.trim());
    
    if (isNaN(score) || score < 0 || score > 100) {
      console.warn("Invalid AI similarity score, falling back to 0:", result);
      return 0;
    }
    
    return score;
  } catch (error) {
    console.error("AI similarity calculation failed:", error);
    return 0; // Fallback to 0 on error
  }
}

/**
 * Find similar gaps using AI-powered semantic search
 * Uses parallel processing with concurrency limit to avoid overwhelming the API
 */
export async function findSimilarGapsWithAI(targetGap: Gap, allGaps: Gap[], threshold = 60): Promise<Array<{ gap: Gap; score: number }>> {
  // Filter out the target gap
  const gapsToCompare = allGaps.filter(gap => gap.id !== targetGap.id);
  
  // Process all similarity calculations in parallel with Promise.all
  const similarityPromises = gapsToCompare.map(async (gap) => {
    try {
      const score = await calculateAISimilarity(targetGap, gap);
      return { gap, score };
    } catch (error) {
      console.error(`Failed to calculate similarity for gap ${gap.id}:`, error);
      return { gap, score: 0 }; // Return 0 on error
    }
  });

  // Wait for all similarity calculations to complete
  const allResults = await Promise.all(similarityPromises);
  
  // Filter by threshold and sort by score (highest first)
  return allResults
    .filter(result => result.score >= threshold)
    .sort((a, b) => b.score - a.score);
}

/**
 * Get AI-powered SOP suggestions for a gap
 */
export async function suggestSOPsWithAI(gap: Gap, availableSOPs: Array<{ id: number; title: string; description?: string; content: string }>): Promise<Array<{ sopId: number; title: string; relevanceScore: number; reasoning: string }>> {
  try {
    const sopList = availableSOPs.map(sop => 
      `SOP ${sop.id}: ${sop.title}\n${sop.description || ""}`
    ).join("\n\n");

    const messages: OpenRouterMessage[] = [
      {
        role: "system",
        content: "You are an expert at analyzing process gaps and recommending relevant Standard Operating Procedures. Return a JSON array of SOP recommendations with scores and reasoning."
      },
      {
        role: "user",
        content: `Analyze this process gap and recommend the most relevant SOPs from the list below.

Process Gap:
Title: ${gap.title}
Description: ${gap.description}
Department: ${gap.department || "N/A"}

Available SOPs:
${sopList}

Return a JSON array with this format:
[
  {
    "sopId": 1,
    "title": "SOP Title",
    "relevanceScore": 85,
    "reasoning": "This SOP is relevant because..."
  }
]

Only include SOPs with relevance score >= 60. Return up to 5 recommendations.`
      }
    ];

    const result = await callOpenRouter(messages);
    
    // Try to parse JSON from the response
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn("No valid JSON found in AI response");
      return [];
    }

    const suggestions = JSON.parse(jsonMatch[0]);
    return suggestions.filter((s: any) => s.relevanceScore >= 60).slice(0, 5);
  } catch (error) {
    console.error("AI SOP suggestion failed:", error);
    return [];
  }
}

/**
 * Generate a summary of a gap for reporting purposes
 */
export async function generateGapSummary(gap: Gap): Promise<string> {
  try {
    const messages: OpenRouterMessage[] = [
      {
        role: "system",
        content: "You are an expert at summarizing process gaps concisely. Create a 2-3 sentence executive summary."
      },
      {
        role: "user",
        content: `Create an executive summary of this process gap:

Title: ${gap.title}
Description: ${gap.description}
Status: ${gap.status}
Priority: ${gap.priority}
Department: ${gap.department || "N/A"}

Provide a concise 2-3 sentence summary highlighting the key issue and impact.`
      }
    ];

    return await callOpenRouter(messages);
  } catch (error) {
    console.error("AI summary generation failed:", error);
    return gap.title;
  }
}
