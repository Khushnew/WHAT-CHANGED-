import { useState, useCallback, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  ArrowRight, 
  Download, 
  Trash2, 
  GitCompare, 
  CheckCircle2,
  Copy,
  FileCode,
  BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { computeDiff, type DiffResult, type ChangeType, generateUnifiedDiff, exportDiffAsJSON } from '@/lib/diffEngine';
import { cn } from '@/lib/utils';
import { Toaster, toast } from 'sonner';

interface FileInfo {
  name: string;
  content: string;
  size: number;
  lines: number;
}

function FileUploadZone({
  label,
  fileInfo,
  onFileSelect,
  onClear,
  color
}: {
  label: string;
  fileInfo: FileInfo | null;
  onFileSelect: (file: File) => void;
  onClear: () => void;
  color: 'blue' | 'green';
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('text/') || file.name.endsWith('.json') || file.name.endsWith('.js') || file.name.endsWith('.ts') || file.name.endsWith('.tsx') || file.name.endsWith('.css') || file.name.endsWith('.html') || file.name.endsWith('.md')) {
      onFileSelect(file);
    } else {
      toast.error('Please upload a text file');
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const colorClasses = {
    blue: 'border-blue-400 bg-blue-50/50 hover:bg-blue-50',
    green: 'border-emerald-400 bg-emerald-50/50 hover:bg-emerald-50'
  };

  const activeColorClasses = {
    blue: 'border-blue-500 bg-blue-100',
    green: 'border-emerald-500 bg-emerald-100'
  };

  return (
    <Card className={cn(
      "transition-all duration-200",
      fileInfo ? "border-solid" : "border-dashed"
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <FileText className="w-4 h-4" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {fileInfo ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                color === 'blue' ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"
              )}>
                <FileCode className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{fileInfo.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(fileInfo.size / 1024).toFixed(1)} KB · {fileInfo.lines} lines
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClear}
                className="shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200",
              isDragging ? activeColorClasses[color] : colorClasses[color]
            )}
          >
            <Upload className={cn(
              "w-8 h-8 mx-auto mb-3",
              color === 'blue' ? "text-blue-500" : "text-emerald-500"
            )} />
            <p className="text-sm font-medium mb-1">Drop file here or click to browse</p>
            <p className="text-xs text-muted-foreground">Supports text files, code, JSON, etc.</p>
            <input
              ref={inputRef}
              type="file"
              accept=".txt,.js,.ts,.tsx,.json,.css,.html,.md,.py,.java,.cpp,.c,.go,.rs"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DiffViewer({ diffResult }: { diffResult: DiffResult }) {
  const getLineColor = (type: ChangeType) => {
    switch (type) {
      case 'added':
        return 'bg-emerald-50 border-l-4 border-emerald-400';
      case 'removed':
        return 'bg-rose-50 border-l-4 border-rose-400';
      case 'modified':
        return 'bg-amber-50 border-l-4 border-amber-400';
      default:
        return 'bg-white border-l-4 border-transparent';
    }
  };

  const getLinePrefix = (type: ChangeType) => {
    switch (type) {
      case 'added':
        return '+';
      case 'removed':
        return '-';
      case 'modified':
        return '~';
      default:
        return ' ';
    }
  };

  const getPrefixColor = (type: ChangeType) => {
    switch (type) {
      case 'added':
        return 'text-emerald-600';
      case 'removed':
        return 'text-rose-600';
      case 'modified':
        return 'text-amber-600';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <div className="bg-gray-50 border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-400" />
            <span className="text-muted-foreground">Added: {diffResult.stats.added}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-400" />
            <span className="text-muted-foreground">Removed: {diffResult.stats.removed}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-400" />
            <span className="text-muted-foreground">Modified: {diffResult.stats.modified}</span>
          </span>
        </div>
      </div>
      <ScrollArea className="h-[500px]">
        <div className="font-mono text-sm">
          {diffResult.blocks.map((block, blockIndex) => (
            <div key={blockIndex}>
              {block.lines.map((line, lineIndex) => (
                <div
                  key={`${blockIndex}-${lineIndex}`}
                  className={cn(
                    "flex items-start px-2 py-0.5 hover:bg-black/5 transition-colors",
                    getLineColor(line.type)
                  )}
                >
                  <span className="flex items-center gap-2 w-full">
                    <span className="flex items-center gap-2 shrink-0 w-20 text-xs text-muted-foreground">
                      <span className="w-8 text-right">
                        {line.oldLineNumber ?? ''}
                      </span>
                      <span className="w-8 text-right">
                        {line.newLineNumber ?? ''}
                      </span>
                    </span>
                    <span className={cn("shrink-0 w-4 font-bold", getPrefixColor(line.type))}>
                      {getLinePrefix(line.type)}
                    </span>
                    <span className="flex-1 whitespace-pre-wrap break-all">
                      {line.content}
                    </span>
                    {line.type === 'modified' && line.similarity !== undefined && (
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {Math.round(line.similarity * 100)}% similar
                      </Badge>
                    )}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function StatsPanel({ diffResult }: { diffResult: DiffResult }) {
  const { stats, similarity } = diffResult;
  const totalChanges = stats.added + stats.removed + stats.modified;
  const changeRate = stats.totalOld > 0 ? (totalChanges / stats.totalOld) * 100 : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Change Statistics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Similarity</span>
              <span className="font-medium">{Math.round(similarity * 100)}%</span>
            </div>
            <Progress value={similarity * 100} className="h-2" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Original Lines</p>
              <p className="text-2xl font-semibold">{stats.totalOld}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">New Lines</p>
              <p className="text-2xl font-semibold">{stats.totalNew}</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Added
              </span>
              <span className="font-medium">{stats.added}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                Removed
              </span>
              <span className="font-medium">{stats.removed}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Modified
              </span>
              <span className="font-medium">{stats.modified}</span>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Change Rate</span>
              <span className="font-medium">{changeRate.toFixed(1)}%</span>
            </div>
            <Progress value={changeRate} className="h-2" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function App() {
  const [oldFile, setOldFile] = useState<FileInfo | null>(null);
  const [newFile, setNewFile] = useState<FileInfo | null>(null);
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  const readFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleFileSelect = useCallback(async (file: File, isOld: boolean) => {
    try {
      const content = await readFile(file);
      const fileInfo: FileInfo = {
        name: file.name,
        content,
        size: file.size,
        lines: content.split('\n').length
      };

      if (isOld) {
        setOldFile(fileInfo);
      } else {
        setNewFile(fileInfo);
      }
      setDiffResult(null);
    } catch (error) {
      toast.error('Failed to read file');
    }
  }, []);

  const handleCompare = useCallback(() => {
    if (!oldFile || !newFile) return;

    setIsComparing(true);
    
    // Use setTimeout to allow UI to update
    setTimeout(() => {
      const result = computeDiff(oldFile.content, newFile.content);
      setDiffResult(result);
      setIsComparing(false);
      toast.success('Comparison complete!');
    }, 100);
  }, [oldFile, newFile]);

  const handleExport = useCallback((format: 'unified' | 'json') => {
    if (!diffResult || !oldFile || !newFile) return;

    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'unified') {
      content = generateUnifiedDiff(diffResult, oldFile.name, newFile.name);
      filename = 'diff.patch';
      mimeType = 'text/plain';
    } else {
      content = exportDiffAsJSON(diffResult);
      filename = 'diff.json';
      mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`Exported as ${format.toUpperCase()}`);
  }, [diffResult, oldFile, newFile]);

  const handleCopyDiff = useCallback(() => {
    if (!diffResult || !oldFile || !newFile) return;
    
    const unifiedDiff = generateUnifiedDiff(diffResult, oldFile.name, newFile.name);
    navigator.clipboard.writeText(unifiedDiff);
    toast.success('Copied to clipboard');
  }, [diffResult, oldFile, newFile]);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gray-50">
        <Toaster position="top-right" />
        
        {/* Header */}
        <header className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2.5 rounded-xl">
                  <GitCompare className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    WhatChanged
                  </h1>
                  <p className="text-xs text-muted-foreground">Exact File Difference Analyzer</p>
                </div>
              </div>
              
              {diffResult && (
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={handleCopyDiff}>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy unified diff</TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => handleExport('unified')}>
                        <Download className="w-4 h-4 mr-2" />
                        Patch
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export as unified diff</TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => handleExport('json')}>
                        <FileCode className="w-4 h-4 mr-2" />
                        JSON
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export as JSON</TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* File Upload Section */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <FileUploadZone
              label="Original File"
              fileInfo={oldFile}
              onFileSelect={(file) => handleFileSelect(file, true)}
              onClear={() => { setOldFile(null); setDiffResult(null); }}
              color="blue"
            />
            
            <div className="relative">
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 hidden md:block">
                <div className="bg-white rounded-full p-2 shadow-lg border">
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
              <FileUploadZone
                label="Modified File"
                fileInfo={newFile}
                onFileSelect={(file) => handleFileSelect(file, false)}
                onClear={() => { setNewFile(null); setDiffResult(null); }}
                color="green"
              />
            </div>
          </div>

          {/* Compare Button */}
          <div className="flex justify-center mb-8">
            <Button
              size="lg"
              onClick={handleCompare}
              disabled={!oldFile || !newFile || isComparing}
              className="min-w-[200px]"
            >
              {isComparing ? (
                <>
                  <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Comparing...
                </>
              ) : (
                <>
                  <GitCompare className="w-4 h-4 mr-2" />
                  Compare Files
                </>
              )}
            </Button>
          </div>

          {/* Results Section */}
          {diffResult && (
            <div className="grid lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3">
                <Tabs defaultValue="side-by-side" className="w-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="side-by-side">Side by Side</TabsTrigger>
                    <TabsTrigger value="unified">Unified</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="side-by-side">
                    <DiffViewer diffResult={diffResult} />
                  </TabsContent>
                  
                  <TabsContent value="unified">
                    <Card>
                      <ScrollArea className="h-[500px]">
                        <pre className="p-4 font-mono text-sm whitespace-pre-wrap">
                          {generateUnifiedDiff(diffResult, oldFile?.name, newFile?.name)}
                        </pre>
                      </ScrollArea>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
              
              <div className="lg:col-span-1">
                <StatsPanel diffResult={diffResult} />
              </div>
            </div>
          )}

          {/* Empty State */}
          {!diffResult && !isComparing && (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <div className="max-w-md mx-auto">
                  <div className="bg-gray-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <GitCompare className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">Ready to Compare</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload two files to see exactly what changed. Our diff engine uses 
                    edit-distance algorithms to find the minimal set of changes.
                  </p>
                  <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Line-level precision
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Block detection
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Similarity analysis
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t bg-white mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <p className="text-xs text-center text-muted-foreground">
              WhatChanged uses Myers' diff algorithm with dynamic programming for optimal performance
            </p>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}

export default App;
