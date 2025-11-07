import type { Gap } from "@shared/schema";

// Simple TF-IDF implementation for text similarity
interface TFIDFVector {
  [term: string]: number;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2); // Filter out very short words
}

function calculateTF(tokens: string[]): TFIDFVector {
  const tf: TFIDFVector = {};
  const totalTerms = tokens.length;

  for (const term of tokens) {
    tf[term] = (tf[term] || 0) + 1;
  }

  // Normalize by total terms
  for (const term in tf) {
    tf[term] = tf[term] / totalTerms;
  }

  return tf;
}

function calculateIDF(documents: string[][]): TFIDFVector {
  const idf: TFIDFVector = {};
  const totalDocs = documents.length;

  const allTerms = new Set<string>();
  documents.forEach((doc) => doc.forEach((term) => allTerms.add(term)));

  for (const term of allTerms) {
    const docsWithTerm = documents.filter((doc) => doc.includes(term)).length;
    idf[term] = Math.log(totalDocs / (1 + docsWithTerm));
  }

  return idf;
}

function calculateTFIDF(tf: TFIDFVector, idf: TFIDFVector): TFIDFVector {
  const tfidf: TFIDFVector = {};

  for (const term in tf) {
    tfidf[term] = tf[term] * (idf[term] || 0);
  }

  return tfidf;
}

function cosineSimilarity(vec1: TFIDFVector, vec2: TFIDFVector): number {
  const allTerms = new Set([...Object.keys(vec1), ...Object.keys(vec2)]);

  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;

  for (const term of allTerms) {
    const val1 = vec1[term] || 0;
    const val2 = vec2[term] || 0;

    dotProduct += val1 * val2;
    mag1 += val1 * val1;
    mag2 += val2 * val2;
  }

  if (mag1 === 0 || mag2 === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

export function calculateSimilarity(text1: string, text2: string, allTexts: string[]): number {
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);
  const allTokens = allTexts.map(tokenize);

  const tf1 = calculateTF(tokens1);
  const tf2 = calculateTF(tokens2);
  const idf = calculateIDF(allTokens);

  const tfidf1 = calculateTFIDF(tf1, idf);
  const tfidf2 = calculateTFIDF(tf2, idf);

  return cosineSimilarity(tfidf1, tfidf2);
}

export async function findSimilarGaps(
  targetGap: Gap,
  allGaps: Gap[],
  threshold: number = 0.6
): Promise<Array<{ gapId: number; score: number }>> {
  const targetText = `${targetGap.title} ${targetGap.description}`;
  
  // Filter out the target gap and get all texts for IDF calculation
  const otherGaps = allGaps.filter((g) => g.id !== targetGap.id);
  const allTexts = otherGaps.map((g) => `${g.title} ${g.description}`);

  const similarities: Array<{ gapId: number; score: number }> = [];

  for (let i = 0; i < otherGaps.length; i++) {
    const gap = otherGaps[i];
    const gapText = `${gap.title} ${gap.description}`;
    
    const similarity = calculateSimilarity(targetText, gapText, allTexts);
    const scorePercent = Math.round(similarity * 100);

    if (scorePercent >= threshold * 100) {
      similarities.push({
        gapId: gap.id,
        score: scorePercent,
      });
    }
  }

  // Sort by score descending and return top 5
  return similarities
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
