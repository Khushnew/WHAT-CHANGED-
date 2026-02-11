/**
 * WhatChanged - Diff Engine
 * 
 * Implements a sophisticated diff algorithm using:
 * - Dynamic programming for minimal edit distance
 * - Hashing for efficient line comparison
 * - LCS (Longest Common Subsequence) for optimal diff
 * - Block-level change detection
 */

export type ChangeType = 'added' | 'removed' | 'unchanged' | 'modified';

export interface LineDiff {
  type: ChangeType;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  content: string;
  oldContent?: string;
  similarity?: number;
}

export interface DiffBlock {
  type: ChangeType;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: LineDiff[];
}

export interface DiffResult {
  blocks: DiffBlock[];
  stats: {
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
    totalOld: number;
    totalNew: number;
  };
  similarity: number;
}

// Simple hash function for line content
function hashLine(line: string): number {
  let hash = 0;
  for (let i = 0; i < line.length; i++) {
    const char = line.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}

// Calculate similarity between two strings (0-1)
function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  
  const maxLen = Math.max(a.length, b.length);
  const editDist = levenshteinDistance(a, b);
  return 1 - editDist / maxLen;
}

// Levenshtein distance for string similarity
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

// Myers' diff algorithm for better performance on large files
function myersDiff(
  oldLines: string[],
  newLines: string[]
): Array<{ type: ChangeType; oldIndex: number | null; newIndex: number | null }> {
  const oldHashes = oldLines.map(hashLine);
  const newHashes = newLines.map(hashLine);
  
  const max = oldLines.length + newLines.length;
  if (max === 0) return [];
  
  const size = 2 * max + 1;
  const v: number[] = new Array(size).fill(-1);
  const trace: number[][] = [];
  
  v[max + 1] = 0;
  
  for (let d = 0; d <= max; d++) {
    trace.push([...v]);
    
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      
      if (k === -d || (k !== d && v[max + k - 1] < v[max + k + 1])) {
        x = v[max + k + 1];
      } else {
        x = v[max + k - 1] + 1;
      }
      
      let y = x - k;
      
      while (x < oldLines.length && y < newLines.length && oldHashes[x] === newHashes[y]) {
        x++;
        y++;
      }
      
      v[max + k] = x;
      
      if (x >= oldLines.length && y >= newLines.length) {
        return backtrack(trace, oldLines, newLines, d, k, max);
      }
    }
  }
  
  return [];
}

// Backtrack through Myers' algorithm to construct the diff
function backtrack(
  trace: number[][],
  _oldLines: string[],
  _newLines: string[],
  _d: number,
  k: number,
  max: number
): Array<{ type: ChangeType; oldIndex: number | null; newIndex: number | null }> {
  const edits: Array<{ type: ChangeType; oldIndex: number | null; newIndex: number | null }> = [];
  
  for (let i = trace.length - 1; i >= 0; i--) {
    const v = trace[i];
    
    const prevK = (k === -i || (k !== i && v[max + k - 1] < v[max + k + 1])) ? k + 1 : k - 1;
    const prevX = v[max + prevK];
    const prevY = prevX - prevK;
    
    // Add diagonal moves (matches)
    while (v[max + k] > prevX && (v[max + k] - prevK) > prevY) {
      const x = v[max + k] - 1;
      const y = x - k;
      edits.unshift({ type: 'unchanged', oldIndex: x, newIndex: y });
    }
    
    // Add the edit that got us here
    if (i > 0) {
      if (k === prevK + 1) {
        edits.unshift({ type: 'removed', oldIndex: prevX, newIndex: null });
      } else {
        edits.unshift({ type: 'added', oldIndex: null, newIndex: prevY });
      }
    }
    
    k = prevK;
  }
  
  return edits;
}

// Detect modified lines (similar but not identical)
function detectModifications(
  edits: Array<{ type: ChangeType; oldIndex: number | null; newIndex: number | null }>,
  oldLines: string[],
  newLines: string[],
  similarityThreshold: number = 0.5
): Array<{ type: ChangeType; oldIndex: number | null; newIndex: number | null; similarity?: number }> {
  const result: Array<{ type: ChangeType; oldIndex: number | null; newIndex: number | null; similarity?: number }> = [];
  
  let i = 0;
  while (i < edits.length) {
    const edit = edits[i];
    
    if (edit.type === 'removed' && i + 1 < edits.length && edits[i + 1].type === 'added') {
      // Check if this could be a modification
      const nextEdit = edits[i + 1];
      const oldContent = oldLines[edit.oldIndex!];
      const newContent = newLines[nextEdit.newIndex!];
      const similarity = calculateSimilarity(oldContent, newContent);
      
      if (similarity >= similarityThreshold) {
        result.push({
          type: 'modified',
          oldIndex: edit.oldIndex,
          newIndex: nextEdit.newIndex,
          similarity
        });
        i += 2;
        continue;
      }
    }
    
    result.push(edit);
    i++;
  }
  
  return result;
}

// Group edits into blocks for better visualization
function groupIntoBlocks(
  edits: Array<{ type: ChangeType; oldIndex: number | null; newIndex: number | null; similarity?: number }>,
  oldLines: string[],
  newLines: string[]
): DiffBlock[] {
  const blocks: DiffBlock[] = [];
  let currentBlock: DiffBlock | null = null;
  
  for (const edit of edits) {
    const lineDiff: LineDiff = {
      type: edit.type as ChangeType,
      oldLineNumber: edit.oldIndex !== null ? edit.oldIndex + 1 : null,
      newLineNumber: edit.newIndex !== null ? edit.newIndex + 1 : null,
      content: edit.newIndex !== null ? newLines[edit.newIndex] : oldLines[edit.oldIndex!],
      similarity: edit.similarity
    };
    
    if (edit.type === 'modified') {
      lineDiff.oldContent = oldLines[edit.oldIndex!];
    }
    
    // Start a new block if needed
    if (!currentBlock || currentBlock.type !== edit.type) {
      if (currentBlock) {
        blocks.push(currentBlock);
      }
      currentBlock = {
        type: edit.type as ChangeType,
        oldStart: edit.oldIndex !== null ? edit.oldIndex + 1 : 0,
        oldCount: edit.oldIndex !== null ? 1 : 0,
        newStart: edit.newIndex !== null ? edit.newIndex + 1 : 0,
        newCount: edit.newIndex !== null ? 1 : 0,
        lines: [lineDiff]
      };
    } else {
      // Add to current block
      if (edit.oldIndex !== null) {
        currentBlock.oldCount++;
      }
      if (edit.newIndex !== null) {
        currentBlock.newCount++;
      }
      currentBlock.lines.push(lineDiff);
    }
  }
  
  if (currentBlock) {
    blocks.push(currentBlock);
  }
  
  return blocks;
}

// Main diff function
export function computeDiff(oldContent: string, newContent: string): DiffResult {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  
  // Handle empty files
  if (oldContent === '' && newContent === '') {
    return {
      blocks: [],
      stats: { added: 0, removed: 0, modified: 0, unchanged: 0, totalOld: 0, totalNew: 0 },
      similarity: 1
    };
  }
  
  if (oldContent === '') {
    const lines: LineDiff[] = newLines.map((line, i) => ({
      type: 'added' as ChangeType,
      oldLineNumber: null,
      newLineNumber: i + 1,
      content: line
    }));
    return {
      blocks: [{ type: 'added', oldStart: 0, oldCount: 0, newStart: 1, newCount: newLines.length, lines }],
      stats: { added: newLines.length, removed: 0, modified: 0, unchanged: 0, totalOld: 0, totalNew: newLines.length },
      similarity: 0
    };
  }
  
  if (newContent === '') {
    const lines: LineDiff[] = oldLines.map((line, i) => ({
      type: 'removed' as ChangeType,
      oldLineNumber: i + 1,
      newLineNumber: null,
      content: line
    }));
    return {
      blocks: [{ type: 'removed', oldStart: 1, oldCount: oldLines.length, newStart: 0, newCount: 0, lines }],
      stats: { added: 0, removed: oldLines.length, modified: 0, unchanged: 0, totalOld: oldLines.length, totalNew: 0 },
      similarity: 0
    };
  }
  
  // Use Myers' diff algorithm
  const edits = myersDiff(oldLines, newLines);
  
  // Detect modifications
  const editsWithModifications = detectModifications(edits, oldLines, newLines);
  
  // Group into blocks
  const blocks = groupIntoBlocks(editsWithModifications, oldLines, newLines);
  
  // Calculate statistics
  const stats = {
    added: 0,
    removed: 0,
    modified: 0,
    unchanged: 0,
    totalOld: oldLines.length,
    totalNew: newLines.length
  };
  
  for (const edit of editsWithModifications) {
    switch (edit.type) {
      case 'added':
        stats.added++;
        break;
      case 'removed':
        stats.removed++;
        break;
      case 'modified':
        stats.modified++;
        break;
      case 'unchanged':
        stats.unchanged++;
        break;
    }
  }
  
  // Calculate overall similarity
  const totalChanges = stats.added + stats.removed + stats.modified;
  const maxLines = Math.max(oldLines.length, newLines.length);
  const similarity = maxLines > 0 ? 1 - totalChanges / maxLines : 1;
  
  return { blocks, stats, similarity };
}

// Generate unified diff format
export function generateUnifiedDiff(
  diffResult: DiffResult,
  oldFileName: string = 'old',
  newFileName: string = 'new',
  _contextLines: number = 3
): string {
  const lines: string[] = [
    `--- ${oldFileName}`,
    `+++ ${newFileName}`
  ];
  
  for (const block of diffResult.blocks) {
    if (block.type === 'unchanged') continue;
    
    const oldRange = block.oldCount === 0 && block.oldStart === 0 
      ? '0,0' 
      : block.oldCount === 1 
        ? `${block.oldStart}` 
        : `${block.oldStart},${block.oldCount}`;
    const newRange = block.newCount === 0 && block.newStart === 0 
      ? '0,0' 
      : block.newCount === 1 
        ? `${block.newStart}` 
        : `${block.newStart},${block.newCount}`;
    
    lines.push(`@@ -${oldRange} +${newRange} @@`);
    
    for (const line of block.lines) {
      const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
      lines.push(`${prefix}${line.content}`);
    }
  }
  
  return lines.join('\n');
}

// Export diff as JSON
export function exportDiffAsJSON(diffResult: DiffResult): string {
  return JSON.stringify(diffResult, null, 2);
}
