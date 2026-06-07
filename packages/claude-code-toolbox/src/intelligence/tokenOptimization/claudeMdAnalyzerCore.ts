/**
 * CLAUDE.md analyzer: section parser, token estimator, duplication detector.
 * Pure logic — no vscode imports.
 */

export type ClaudeMdSection = {
  heading: string;
  level: number;
  startLine: number;
  endLine: number;
  charCount: number;
  tokenEstimate: number;
  content: string;
};

export type DuplicateMatch = {
  sectionA: string;
  sectionB: string;
  overlapPercent: number;
};

export type AnalysisResult = {
  totalChars: number;
  totalTokens: number;
  sections: ClaudeMdSection[];
  oversizedSections: ClaudeMdSection[];
  duplicates: DuplicateMatch[];
  recommendations: string[];
};

export function analyzeClaudeMd(content: string): AnalysisResult {
  const sections = parseSections(content);
  const totalChars = content.length;
  const totalTokens = Math.ceil(totalChars / 4);

  const oversizedSections = sections.filter((s) => s.tokenEstimate > 500);
  const duplicates = findDuplicates(sections);
  const recommendations = buildRecommendations(totalTokens, sections, oversizedSections, duplicates);

  return {
    totalChars,
    totalTokens,
    sections,
    oversizedSections,
    duplicates,
    recommendations,
  };
}

export function parseSections(content: string): ClaudeMdSection[] {
  const lines = content.split("\n");
  const sections: ClaudeMdSection[] = [];
  let currentHeading = "(preamble)";
  let currentLevel = 0;
  let startLine = 0;
  let sectionLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const headingMatch = lines[i].match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      if (sectionLines.length > 0 || currentHeading !== "(preamble)") {
        const sectionContent = sectionLines.join("\n");
        sections.push({
          heading: currentHeading,
          level: currentLevel,
          startLine,
          endLine: i - 1,
          charCount: sectionContent.length,
          tokenEstimate: Math.ceil(sectionContent.length / 4),
          content: sectionContent,
        });
      }
      currentHeading = headingMatch[2].trim();
      currentLevel = headingMatch[1].length;
      startLine = i;
      sectionLines = [lines[i]];
    } else {
      sectionLines.push(lines[i]);
    }
  }

  if (sectionLines.length > 0) {
    const sectionContent = sectionLines.join("\n");
    sections.push({
      heading: currentHeading,
      level: currentLevel,
      startLine,
      endLine: lines.length - 1,
      charCount: sectionContent.length,
      tokenEstimate: Math.ceil(sectionContent.length / 4),
      content: sectionContent,
    });
  }

  return sections;
}

function findDuplicates(sections: ClaudeMdSection[]): DuplicateMatch[] {
  const duplicates: DuplicateMatch[] = [];
  for (let i = 0; i < sections.length; i++) {
    for (let j = i + 1; j < sections.length; j++) {
      const overlap = computeOverlap(sections[i].content, sections[j].content);
      if (overlap > 0.8) {
        duplicates.push({
          sectionA: sections[i].heading,
          sectionB: sections[j].heading,
          overlapPercent: Math.round(overlap * 100),
        });
      }
    }
  }
  return duplicates;
}

function computeOverlap(a: string, b: string): number {
  if (a.length < 50 || b.length < 50) return 0;

  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 3));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }

  const union = wordsA.size + wordsB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function buildRecommendations(
  totalTokens: number,
  sections: ClaudeMdSection[],
  oversized: ClaudeMdSection[],
  duplicates: DuplicateMatch[]
): string[] {
  const recs: string[] = [];

  if (totalTokens > 3000) {
    recs.push(`CLAUDE.md is ${totalTokens} tokens — consider keeping under 3,000 for best cost efficiency (research shows diminishing returns past ~800 tokens).`);
  }

  if (oversized.length > 0) {
    const names = oversized.map((s) => `"${s.heading}" (${s.tokenEstimate} tokens)`).join(", ");
    recs.push(`Oversized sections: ${names}. Consider splitting or compressing.`);
  }

  if (duplicates.length > 0) {
    for (const d of duplicates) {
      recs.push(`Duplicate content (${d.overlapPercent}% overlap): "${d.sectionA}" and "${d.sectionB}". Merge or remove one.`);
    }
  }

  const emptySections = sections.filter((s) => s.charCount < 20 && s.heading !== "(preamble)");
  if (emptySections.length > 0) {
    recs.push(`${emptySections.length} nearly-empty section(s) — remove if unused.`);
  }

  if (recs.length === 0) {
    recs.push("CLAUDE.md looks healthy. No optimization needed.");
  }

  return recs;
}

export function formatAnalysisMarkdown(result: AnalysisResult): string {
  const lines: string[] = [];
  lines.push("# CLAUDE.md Token Analysis");
  lines.push("");
  lines.push(`**Total:** ${result.totalTokens} tokens (${result.totalChars} chars) across ${result.sections.length} sections`);
  lines.push("");

  lines.push("## Section breakdown");
  lines.push("");
  lines.push("| Section | Tokens | Lines |");
  lines.push("|---------|--------|-------|");
  for (const s of result.sections) {
    const flag = s.tokenEstimate > 500 ? " **[large]**" : "";
    lines.push(`| ${s.heading}${flag} | ${s.tokenEstimate} | ${s.startLine + 1}-${s.endLine + 1} |`);
  }
  lines.push("");

  if (result.duplicates.length > 0) {
    lines.push("## Duplicate content detected");
    lines.push("");
    for (const d of result.duplicates) {
      lines.push(`- "${d.sectionA}" ↔ "${d.sectionB}" (${d.overlapPercent}% overlap)`);
    }
    lines.push("");
  }

  lines.push("## Recommendations");
  lines.push("");
  for (const r of result.recommendations) {
    lines.push(`- ${r}`);
  }
  lines.push("");
  lines.push("---");
  lines.push("_Generated by Claude Code ToolBox — Token Optimization._");
  return lines.join("\n");
}
