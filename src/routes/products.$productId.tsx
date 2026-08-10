import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getProduct } from "@/data/products";
import { runRagSearch } from "@/lib/rag.functions";
import { Loader2 } from "lucide-react";

import {
  ArrowLeft,
  Sparkles,
  FileText,
  Download,
  Calendar as CalendarIcon,
  ChevronDown,
  GitCommit,
  User,
  FolderGit2,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/products/$productId")({
  head: () => ({
    meta: [
      { title: "Product Workspace — AI Documentation & Code Search" },
      {
        name: "description",
        content:
          "Ask AI questions about documentation and source code changes across your teams and components.",
      },
      { property: "og:title", content: "Product Workspace — AI Documentation & Code Search" },
      {
        property: "og:description",
        content:
          "Ask AI questions about documentation and source code changes across your teams and components.",
      },
    ],
  }),
  component: Workspace,
});

const TEAMS = ["Titans", "Sparta", "Atlas", "Phoenix"];
const COMPONENTS = ["API Gateway", "Portal", "Authentication", "Runtime", "UI", "OAuth"];
const DEFAULT_BLAZEMETER_REPO_ID = "github.com/Blazemeter/helm-crane";
const TAURUS_REPO_ID = "github.com/Blazemeter/taurus";

const EXAMPLE_PROMPTS = [
  "What changed in authentication last month?",
  "Show API updates for OAuth.",
  "Summarize documentation updates from Team Titans.",
  "Generate release notes for Portal changes.",
];

type ResultTag = "Documentation" | "Code" | "Configuration" | "API";

interface ChangeResult {
  id: string;
  title: string;
  summary: string;
  repository: string;
  author: string;
  modified: string;
  tags: ResultTag[];
  detail: string;
  filePath: string;
  commit: string;
  diff: string;
  jira?: string;
}

const MOCK_RESULTS: ChangeResult[] = [
  {
    id: "1",
    title: "Refactored OAuth token refresh flow",
    summary:
      "Updated the OAuth token refresh handler to use rotating refresh tokens and added retry with backoff.",
    repository: "akana/api-gateway",
    author: "priya.sharma",
    modified: "2025-07-18",
    tags: ["Code", "API"],
    detail:
      "The OAuth 2.0 refresh flow now issues rotating refresh tokens. Old tokens are invalidated on first reuse, and a 3-attempt exponential backoff was added for upstream identity provider failures. Docs updated to describe the new client behavior.",
    filePath: "src/auth/oauth/refresh.ts",
    commit: "a1f4c92 — Rotate refresh tokens on use",
    diff: `- const token = await issueRefresh(userId);
+ const token = await issueRotatingRefresh(userId);
+ await invalidatePrevious(userId);`,
    jira: "AKN-2481",
  },
  {
    id: "2",
    title: "Updated API Gateway rate limit documentation",
    summary:
      "Clarified per-key vs per-tenant limits and added examples for the 429 response envelope.",
    repository: "akana/docs",
    author: "diego.martinez",
    modified: "2025-07-14",
    tags: ["Documentation"],
    detail:
      "The rate limit page now distinguishes per-key from per-tenant policies. Added a full 429 response example, retry-after semantics, and a migration note for customers on legacy fixed-window limits.",
    filePath: "docs/api-gateway/rate-limits.mdx",
    commit: "3c8de10 — Docs: clarify rate limits",
    diff: `+ ## Per-tenant limits
+ Tenants are limited to 10,000 rpm aggregated across all keys.`,
  },
  {
    id: "3",
    title: "Portal: SSO callback config for enterprise tenants",
    summary:
      "Introduced tenant-scoped SSO callback URLs and validation for wildcard redirect patterns.",
    repository: "akana/portal",
    author: "linh.tran",
    modified: "2025-07-09",
    tags: ["Configuration", "Code"],
    detail:
      "Enterprise tenants can now configure multiple SSO callback URLs. Wildcards are validated against a strict pattern and stored per tenant. Existing single-URL configs are auto-migrated.",
    filePath: "portal/src/settings/sso.ts",
    commit: "77b0aa2 — Multi-callback SSO",
    diff: `- callbackUrl: string
+ callbackUrls: string[]`,
    jira: "AKN-2416",
  },
];

function Workspace() {
  const { productId } = Route.useParams();
  const product = getProduct(productId);
  const isSupportedProduct = product?.id === "blazemeter";
  const productName = product?.name ?? "Product";
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"standard" | "direct">("standard");
  const [team, setTeam] = useState<string>("");
  const [component, setComponent] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [hasSearched, setHasSearched] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [aiText, setAiText] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string>("");
  const ragSearch = useServerFn(runRagSearch);

  const applyPreset = (days: number | "custom") => {
    if (days === "custom") return;
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days);
    setFromDate(from.toISOString().slice(0, 10));
    setToDate(to.toISOString().slice(0, 10));
  };

  const handleSearch = async () => {
    if (!query.trim()) return;

    if (!team) {
      setHasSearched(true);
      setAiLoading(false);
      setAiText("");
      setAiError("Please select a team before searching.");
      return;
    }

    setHasSearched(true);
    setAiLoading(true);
    setAiError("");
    setAiText("");
    try {
      const data = await ragSearch({
        data: {
          queryText: query.trim(),
          repoId: inferBlazeMeterRepoId(query),
          type: mode,
          limit: 15,
          endpoint: "search",
        },
      });
      setAiText(data.answer);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Failed to fetch mock API response");
    } finally {
      setAiLoading(false);
    }
  };

  if (!isSupportedProduct) {
    return <UnsupportedProduct productName={product?.name} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm" className="gap-1.5 -ml-2">
              <Link to="/">
                <ArrowLeft className="h-4 w-4" />
                Back to Products
              </Link>
            </Button>
            <Separator orientation="vertical" className="h-5" />
            <Badge variant="secondary" className="rounded-md font-medium">
              {productName}
            </Badge>
          </div>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              JS
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {/* Toolbar */}
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[280px] flex-1">
              <Sparkles className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask anything about documentation or source code changes..."
                className="pl-9 h-10"
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>

            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(v) => v && setMode(v as "standard" | "direct")}
              className="rounded-md border border-border p-0.5"
            >
              <ToggleGroupItem value="standard" className="h-9 px-3 text-xs">
                Standard
              </ToggleGroupItem>
              <ToggleGroupItem value="direct" className="h-9 px-3 text-xs">
                Direct
              </ToggleGroupItem>
            </ToggleGroup>

            <Select value={team} onValueChange={setTeam}>
              <SelectTrigger className="h-10 w-[130px]">
                <SelectValue placeholder="Team *" />
              </SelectTrigger>
              <SelectContent>
                {TEAMS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={component} onValueChange={setComponent}>
              <SelectTrigger className="h-10 w-[150px]">
                <SelectValue placeholder="Component" />
              </SelectTrigger>
              <SelectContent>
                {COMPONENTS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-10 gap-1.5 font-normal">
                  <CalendarIcon className="h-4 w-4" />
                  {fromDate && toDate ? `${fromDate} → ${toDate}` : "Time frame"}
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 space-y-3" align="end">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">From</Label>
                    <Input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">To</Label>
                    <Input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Last 7 Days", v: 7 as const },
                    { label: "Last 30 Days", v: 30 as const },
                    { label: "Last 90 Days", v: 90 as const },
                    { label: "Custom", v: "custom" as const },
                  ].map((p) => (
                    <Button
                      key={p.label}
                      variant="ghost"
                      size="sm"
                      className="justify-start"
                      onClick={() => applyPreset(p.v)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Results */}
        <section className="mt-6">
          {!hasSearched ? (
            <EmptyState onPick={(p) => setQuery(p)} />
          ) : (
            <>
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" />
                    {mode === "standard" ? "AI Release Summary" : "AI Answer"}
                  </div>
                  {aiLoading ? (
                    <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating {mode === "standard" ? "release summary" : "answer"}…
                    </p>
                  ) : aiError ? (
                    <p className="text-sm text-destructive">{aiError}</p>
                  ) : aiText ? (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {aiText}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No response yet.</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                  <Button size="sm" className="gap-1.5" onClick={() => setGenOpen(true)}>
                    <FileText className="h-4 w-4" />
                    Generate Document
                  </Button>
                </div>
              </div>

            </>
          )}
        </section>
      </main>

      <GenerateDocumentDialog
        open={genOpen}
        onOpenChange={setGenOpen}
        productName={productName}
        query={query}
        aiText={aiText}
      />
    </div>
  );
}

function inferBlazeMeterRepoId(query: string) {
  const normalizedQuery = query.toLowerCase();

  if (
    normalizedQuery.includes("taurus") ||
    normalizedQuery.includes("k6") ||
    normalizedQuery.includes("playwright") ||
    normalizedQuery.includes("custom reporter")
  ) {
    return TAURUS_REPO_ID;
  }

  return DEFAULT_BLAZEMETER_REPO_ID;
}

function UnsupportedProduct({ productName }: { productName?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          {productName ?? "This product"} workspace is not ready yet
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          BlazeMeter is the first product wired to the AI workspace.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Back to Products</Link>
        </Button>
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (p: string) => void }) {
  return (
    <div className="mx-auto mt-16 max-w-2xl text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Sparkles className="h-5 w-5 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold">Ask AI about your code and docs</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Try one of these prompts to get started
      </p>
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {EXAMPLE_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => onPick(p)}
            className="rounded-lg border border-border bg-card px-4 py-3 text-left text-sm text-foreground transition-colors hover:border-foreground/20 hover:bg-accent"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

function ResultCard({
  result,
  mode,
  open,
  onToggle,
}: {
  result: ChangeResult;
  mode: "standard" | "direct";
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Collapsible open={open} onOpenChange={onToggle}>
      <div className="rounded-lg border border-border bg-card transition-colors hover:border-foreground/20">
        <CollapsibleTrigger className="w-full text-left">
          <div className="flex items-start gap-4 p-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-foreground">{result.title}</h3>
              </div>
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                {result.summary}
              </p>
              {mode !== "standard" && (
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <FolderGit2 className="h-3.5 w-3.5" />
                    {result.repository}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    {result.author}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {result.modified}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5" />
                    {result.tags.map((t) => (
                      <Badge
                        key={t}
                        variant="outline"
                        className="rounded px-1.5 py-0 text-[10px] font-normal"
                      >
                        {t}
                      </Badge>
                    ))}
                  </span>
                </div>
              )}
            </div>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border p-4 space-y-4 text-sm">
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                AI Explanation
              </div>
              <p className="leading-relaxed text-foreground">{result.detail}</p>
            </div>
            {mode !== "standard" && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoRow label="File" value={result.filePath} mono />
                  <InfoRow
                    label="Commit"
                    value={
                      <span className="inline-flex items-center gap-1.5">
                        <GitCommit className="h-3.5 w-3.5" />
                        {result.commit}
                      </span>
                    }
                  />
                  {result.jira && <InfoRow label="Jira" value={result.jira} />}
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Diff Preview
                  </div>
                  <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 text-xs font-mono leading-relaxed">
                    {result.diff}
                  </pre>
                </div>
              </>
            )}

          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`mt-0.5 text-sm text-foreground ${mono ? "font-mono" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function GenerateDocumentDialog({
  open,
  onOpenChange,
  productName,
  query,
  aiText,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productName: string;
  query: string;
  aiText: string;
}) {
  const [title, setTitle] = useState("");
  const [lastAutoTitle, setLastAutoTitle] = useState("");
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeChanges, setIncludeChanges] = useState(true);
  const [includeDiff, setIncludeDiff] = useState(false);

  useEffect(() => {
    if (!open) return;

    const date = new Date().toISOString().slice(0, 10);
    const topic = query.trim() || "Documentation Changes";
    const nextTitle = `${productName} KB Article - ${topic} - ${date}`;

    if (!title || title === lastAutoTitle) {
      setTitle(nextTitle);
      setLastAutoTitle(nextTitle);
    }
  }, [open, productName, query, title, lastAutoTitle]);

  const handleGenerate = (documentType: DocumentType) => {
    const documentTitle = title.trim() || lastAutoTitle || `${productName} KB Article`;
    const markdown = buildMarkdownDocument({
      title: documentTitle,
      documentType,
      productName,
      query,
      aiText,
      includeSummary,
      includeChanges,
      includeDiff,
    });
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slugify(documentTitle)}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Document</DialogTitle>
          <DialogDescription>
            Create a document from the current search results.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="doc-title">Document Title</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. BlazeMeter performance testing — July release notes"
            />
          </div>

          <div className="space-y-2">
            <Label>Options</Label>
            <div className="space-y-2">
              <CheckboxRow
                label="Include AI Summary"
                checked={includeSummary}
                onChange={setIncludeSummary}
              />
              <CheckboxRow
                label="Include Selected Changes"
                checked={includeChanges}
                onChange={setIncludeChanges}
              />
              <CheckboxRow
                label="Include Code Diff"
                checked={includeDiff}
                onChange={setIncludeDiff}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <div className="flex justify-end">
            <Button
              onClick={() => handleGenerate("kb-article")}
              className="rounded-r-none"
            >
              Generate KB Article
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label="Choose document type"
                  className="rounded-l-none border-l border-primary-foreground/20 px-2"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {DOCUMENT_TYPES.filter((type) => type.id !== "kb-article").map((type) => (
                  <DropdownMenuItem
                    key={type.id}
                    onClick={() => handleGenerate(type.id)}
                  >
                    {type.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type DocumentType =
  | "kb-article"
  | "release-notes"
  | "technical"
  | "api"
  | "user-guide"
  | "change-summary";

const DOCUMENT_TYPES: { id: DocumentType; label: string }[] = [
  { id: "kb-article", label: "KB Article" },
  { id: "release-notes", label: "Release Notes" },
  { id: "technical", label: "Technical Documentation" },
  { id: "api", label: "API Documentation" },
  { id: "user-guide", label: "User Guide" },
  { id: "change-summary", label: "Change Summary" },
];

function buildMarkdownDocument({
  title,
  documentType,
  productName,
  query,
  aiText,
  includeSummary,
  includeChanges,
  includeDiff,
}: {
  title: string;
  documentType: DocumentType;
  productName: string;
  query: string;
  aiText: string;
  includeSummary: boolean;
  includeChanges: boolean;
  includeDiff: boolean;
}) {
  const documentLabel =
    DOCUMENT_TYPES.find((type) => type.id === documentType)?.label ?? "KB Article";
  const lines = [
    `# ${title}`,
    "",
    `**Product:** ${productName}`,
    `**Document Type:** ${documentLabel}`,
    `**Format:** Markdown`,
    `**Generated:** ${new Date().toLocaleDateString()}`,
    "",
  ];

  if (query.trim()) {
    lines.push("## Source Query", "", query.trim(), "");
  }

  if (includeSummary) {
    lines.push("## AI Summary", "", aiText.trim() || "No AI summary was generated.", "");
  }

  if (includeChanges) {
    lines.push("## Selected Changes", "");
    MOCK_RESULTS.forEach((result) => {
      lines.push(
        `### ${result.title}`,
        "",
        result.summary,
        "",
        `- Repository: ${result.repository}`,
        `- Author: ${result.author}`,
        `- Modified: ${result.modified}`,
        `- File: ${result.filePath}`,
        `- Commit: ${result.commit}`,
        "",
      );

      if (includeDiff) {
        lines.push("```diff", result.diff, "```", "");
      }
    });
  }

  return lines.join("\n");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
      {label}
    </label>
  );
}
