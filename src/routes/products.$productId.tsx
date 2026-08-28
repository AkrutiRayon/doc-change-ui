import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getProduct } from "@/data/products";
import orcLogo from "@/assets/logos/orc.png";
import { runRagSearch } from "@/lib/rag.functions";
import { ArrowLeft, Calendar as CalendarIcon, FileText, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

const COMPONENTS = ["Taurus", "Helm-crane", "BZM-MCP", "SV-MCP"] as const;
const TEAMS = ["Titans", "Sparta", "Atlas", "Phoenix"];
const LIMITS = [10, 15, 20, 25, 30, 35, 40, 45, 50];
const REPO_ID_BY_COMPONENT: Record<(typeof COMPONENTS)[number], string> = {
  Taurus: "github.com/Blazemeter/taurus",
  "Helm-crane": "github.com/Blazemeter/helm-crane",
  "BZM-MCP": "github.com/Blazemeter/bzm-mcp",
  "SV-MCP": "github.com/Blazemeter/sv-mcp",
};

type ComponentName = (typeof COMPONENTS)[number];
type ExamplePrompt = {
  prompt: string;
  component: ComponentName;
  mode: "standard" | "direct";
};
const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    prompt: "What changed in Taurus in the last 30 days?",
    component: "Taurus",
    mode: "standard",
  },
  {
    prompt: "How do I configure secrets in k6 in Taurus YAML?",
    component: "Taurus",
    mode: "direct",
  },
  {
    prompt: "What changed in the Helm-crane Helm chart?",
    component: "Helm-crane",
    mode: "standard",
  },
  {
    prompt: "How do I get started with BlazeMeter MCP?",
    component: "BZM-MCP",
    mode: "direct",
  },
];
type DocDecisionResponse = {
  status: string;
  documentLinks: DocumentLink[];
  markdownLabel: "changes_markdown" | "body_markdown";
  markdown: string;
  warnings: string[];
};
type DocumentLink = {
  label: string;
  href?: string;
};
type UiRagRequest = {
  queryText: string;
  repoId: string;
  type: "standard" | "direct";
  limit: number;
  endpoint: "search" | "generate-doc";
  fromDate?: string;
  toDate?: string;
};
type BackendRagPayload = {
  query_text: string;
  repo_id: string;
  limit: number;
  type: "standard" | "direct";
  from_date?: string;
  to_date?: string;
};

function Workspace() {
  const { productId } = Route.useParams();
  const product = getProduct(productId);
  const isSupportedProduct = product?.id === "blazemeter";
  const productName = product?.name ?? "Product";
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"standard" | "direct">("standard");
  const [team, setTeam] = useState<string>("");
  const [component, setComponent] = useState<ComponentName | "">("");
  const [limit, setLimit] = useState<number | undefined>(undefined);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [aiText, setAiText] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string>("");
  const [docNeeded, setDocNeeded] = useState(false);
  
  const ragSearch = useServerFn(runRagSearch);
  const handleDocNeededChange = (checked: boolean) => {
    setDocNeeded(checked);

    if (!checked) {
      setHasSearched(false);
      setAiText("");
      setAiError("");
      setAiLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;

    if (!component) {
      setHasSearched(true);
      setAiLoading(false);
      setAiText("");
      setAiError("Please select a component before searching.");
      return;
    }

    setHasSearched(true);
    setAiLoading(true);
    setAiError("");
    setAiText("");
    const timeframe = mode === "standard" ? getStandardTimeframe(fromDate, toDate) : null;
    const requestPayload = {
      queryText: query.trim(),
      repoId: REPO_ID_BY_COMPONENT[component],
      type: mode,
      limit: limit ?? 15,
      endpoint: docNeeded ? "generate-doc" : "search",
      ...(timeframe ? { fromDate: timeframe.fromDate, toDate: timeframe.toDate } : {}),
      // unique value to avoid client-side/server-side caching of identical payloads
      bustCache: Date.now(),
    } as const;
    const finalPayload = toBackendPayload(requestPayload);

    console.info("[RAG UI final payload]", finalPayload);
    console.info("[RAG UI curl equivalent]", buildCurlEquivalent(finalPayload, requestPayload.endpoint));

    try {
      const data = await ragSearch({ data: requestPayload });

      console.info("[RAG UI raw server-fn response]", data);
      console.info("[RAG UI render source]", {
        rendersField: docNeeded ? "full generate-doc response" : "answer",
        rawLlmResponse: docNeeded ? data : data.answer,
      });

      const answer = docNeeded ? normalizeRagAnswer(data) : rawAnswerText(data.answer);
      setAiText(answer);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Failed to fetch RAG API response");
    } finally {
      setAiLoading(false);
    }
  };

  if (!isSupportedProduct) {
    return <UnsupportedProduct productName={product?.name} />;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
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

      <main className="relative z-10 mx-auto max-w-7xl px-6 py-6">
        {/* Toolbar */}
        <div className="rounded-lg border border-border bg-card/95 p-3 shadow-sm backdrop-blur">
          <div className="flex flex-nowrap items-center gap-2 overflow-x-hidden">
            <div className="relative min-w-[360px] flex-[1_1_360px]">
              <Sparkles className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="text"
                placeholder="Ask anything about documentation or source code changes..."
                className="h-10 w-full min-w-0 rounded-md border border-border bg-white py-2.5 pl-9 pr-3 text-[13px] text-black placeholder:text-muted-foreground outline-none focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring/20"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
              />
            </div>

            <div className="flex items-center gap-2 whitespace-nowrap rounded-md border border-border bg-card px-3 py-2 text-sm">
              <Checkbox
                checked={docNeeded}
                onCheckedChange={(checked) => handleDocNeededChange(Boolean(checked))}
                id="doc-needed"
              />
              <Label htmlFor="doc-needed" className="cursor-pointer text-sm">
                Doc Gen
              </Label>
            </div>

            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(v) => !docNeeded && v && setMode(v as "standard" | "direct")}
              className={`rounded-md border border-border p-0.5 ${
                docNeeded ? "pointer-events-none opacity-50" : ""
              }`}
            >
              <ToggleGroupItem value="standard" className="h-9 px-3 text-xs" disabled={docNeeded}>
                Standard
              </ToggleGroupItem>
              <ToggleGroupItem value="direct" className="h-9 px-3 text-xs" disabled={docNeeded}>
                Direct
              </ToggleGroupItem>
            </ToggleGroup>

            <Select value={team} onValueChange={setTeam}>
              <SelectTrigger className="h-10 w-[110px]">
                <SelectValue placeholder="Team" />
              </SelectTrigger>
              <SelectContent>
                {TEAMS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={component}
              onValueChange={(value) => setComponent(value as ComponentName)}
            >
              <SelectTrigger className="h-10 w-[150px] !text-black">
                <SelectValue placeholder="Component *" />
              </SelectTrigger>
              <SelectContent>
                {COMPONENTS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={limit === undefined ? "" : String(limit)} onValueChange={(value) => setLimit(Number(value))}>
              <SelectTrigger className="h-10 w-[110px] !text-black">
                <SelectValue placeholder="Limit" />
              </SelectTrigger>
              <SelectContent>
                {LIMITS.map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {mode === "standard" && (
              <TimeframePicker
                fromDate={fromDate}
                toDate={toDate}
                disabled={docNeeded}
                onChange={(nextFromDate, nextToDate) => {
                  setFromDate(nextFromDate);
                  setToDate(nextToDate);
                }}
              />
            )}

            <Button
              aria-label="Search"
              onClick={handleSearch}
              disabled={aiLoading}
              className="h-10 gap-2 rounded-lg !bg-black px-5 font-medium !text-white shadow-md shadow-black/10 transition-all hover:-translate-y-0.5 hover:!bg-black hover:!text-white hover:shadow-lg hover:shadow-black/20 active:translate-y-0 active:!bg-black"
            >
              {aiLoading ? (
                <>
                  Search
                  <Sparkles className="h-4 w-4 animate-pulse" />
                </>
              ) : (
                <>
                  Search
                  <Sparkles className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
              
        </div>
        {mode === "standard" && (
          <p className="mt-2 text-xs text-muted-foreground">
            Time frame applies to Standard searches. If no dates are selected, the default
            search window is the last 30 days.
          </p>
        )}

        {/* Results */}
        <section className="mt-6">
          {!hasSearched ? (
            <EmptyState
              onPick={(example) => {
                setQuery(example.prompt);
                setComponent(example.component);
                setMode(example.mode);
                setHasSearched(false);
                setAiText("");
                setAiError("");
              }}
            />
          ) : (
            <>
              <div className="mb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" />
                    {mode === "standard" ? "AI Release Summary" : "AI Answer"}
                  </div>
                  {!docNeeded && (
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" className="gap-1.5" onClick={() => setGenOpen(true)}>
                        <FileText className="h-4 w-4" />
                        Generate Document
                      </Button>
                    </div>
                  )}
                </div>
                <div className="mt-2">
                  {aiLoading ? (
                    <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="inline-flex h-12 w-16 items-center justify-center">
                        <img
                          src={orcLogo}
                          alt=""
                          aria-hidden="true"
                          className="h-12 w-16 object-contain logo-float"
                        />
                      </span>
                      Generating {mode === "standard" ? "release summary" : "answer"}…
                    </p>
                  ) : aiError ? (
                    <p className="text-sm text-destructive">{aiError}</p>
                  ) : aiText ? (
                    docNeeded ? (
                      <DocDecisionResult
                        aiText={aiText}
                        query={query}
                        component={component || productName}
                        repoId={component ? REPO_ID_BY_COMPONENT[component] : ""}
                      />
                    ) : (
                      <MarkdownAnswer markdown={getDisplayMarkdown(aiText)} />
                    )
                  ) : (
                    <p className="text-sm text-muted-foreground">No response yet.</p>
                  )}
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
        component={component}
        mode={mode}
        limit={limit ?? 15}
        fromDate={fromDate}
        toDate={toDate}
      />
    </div>
  );
}

function MarkdownAnswer({
  markdown,
  showToc = true,
  framed = true,
}: {
  markdown: string;
  showToc?: boolean;
  framed?: boolean;
}) {
  const lines = markdown.split("\n");
  const blocks: React.ReactNode[] = [];
  const headings: { id: string; text: string; level: number }[] = [];
  let listItems: string[] = [];
  let orderedItems: string[] = [];
  let codeLines: string[] = [];
  let codeLanguage = "";
  let inCodeBlock = false;

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="my-5 list-disc space-y-3 pl-6 text-slate-700">
          {listItems.map((item, index) => (
            <li key={index}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>,
      );
      listItems = [];
    }

    if (orderedItems.length > 0) {
      blocks.push(
        <ol key={`ol-${blocks.length}`} className="my-5 list-decimal space-y-3 pl-6 text-slate-700">
          {orderedItems.map((item, index) => (
            <li key={index}>{renderInlineMarkdown(item)}</li>
          ))}
        </ol>,
      );
      orderedItems = [];
    }
  };

  const flushCodeBlock = () => {
    blocks.push(
      <div
        key={`code-${blocks.length}`}
        className="my-5 overflow-hidden rounded-md border border-slate-200 bg-slate-50 shadow-sm"
      >
        <pre className="overflow-x-auto px-5 py-4 text-[15px] leading-7">
          <code className="font-mono text-slate-950">
            {renderCodeWithHighlight(codeLines.join("\n"))}
          </code>
        </pre>
      </div>,
    );
    codeLines = [];
    codeLanguage = "";
  };

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        flushCodeBlock();
        inCodeBlock = false;
      } else {
        flushList();
        codeLanguage = trimmed.slice(3).trim();
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }

    if (!trimmed) {
      flushList();
      return;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushList();
      const level = heading[1]!.length;
      const headingText = heading[2]!;
      const headingId = `${slugifyHeading(headingText)}-${headings.length}`;
      headings.push({ id: headingId, text: stripMarkdown(headingText), level });
      const content = renderInlineMarkdown(headingText);
      if (level === 1) {
        blocks.push(
          <h1
            id={headingId}
            key={`h-${blocks.length}`}
            className="mb-4 mt-6 scroll-mt-20 text-3xl font-semibold tracking-tight text-slate-950"
          >
            {content}
          </h1>,
        );
      } else if (level === 2) {
        blocks.push(
          <h2
            id={headingId}
            key={`h-${blocks.length}`}
            className="mb-3 mt-6 scroll-mt-20 text-2xl font-semibold tracking-tight text-slate-900"
          >
            {content}
          </h2>,
        );
      } else {
        blocks.push(
          <h3
            id={headingId}
            key={`h-${blocks.length}`}
            className="mb-3 mt-5 scroll-mt-20 text-xl font-semibold text-slate-900"
          >
            {content}
          </h3>,
        );
      }
      return;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      orderedItems = [];
      listItems.push(bullet[1]!);
      return;
    }

    const numbered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (numbered) {
      listItems = [];
      orderedItems.push(numbered[1]!);
      return;
    }

    flushList();
    blocks.push(
      <p key={`p-${blocks.length}`} className="my-4 text-slate-700">
        {renderInlineMarkdown(trimmed)}
      </p>,
    );
  });

  flushList();
  if (inCodeBlock) flushCodeBlock();

  return (
    <div className="markdown-body grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
      <article
        className={`min-w-0 text-base leading-8 text-foreground ${
          framed ? "rounded-3xl border border-border bg-card p-6 shadow-sm" : ""
        }`}
      >
        {blocks}
      </article>
      {showToc && headings.length > 0 && (
        <aside className="hidden border-l border-border pl-5 lg:block">
          <nav className="sticky top-20 max-h-[calc(100vh-7rem)] overflow-auto text-sm">
            <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Sections
            </div>
            <div className="space-y-1">
              {headings.map((heading) => (
                <a
                  key={heading.id}
                  href={`#${heading.id}`}
                  className={`block rounded px-2 py-1.5 text-primary transition-colors hover:bg-accent ${
                    heading.level >= 3 ? "ml-4 text-xs" : ""
                  }`}
                >
                  {heading.text}
                </a>
              ))}
            </div>
          </nav>
        </aside>
      )}
    </div>
  );
}

function DocDecisionResult({
  aiText,
  query,
  component,
  repoId,
}: {
  aiText: string;
  query: string;
  component: string;
  repoId: string;
}) {
  const [genOpen, setGenOpen] = useState(false);
  const decision = parseDocDecisionResponse(aiText, repoId);
  const documentTitle = generateDocumentTitle(query, decision.markdown, component);
  const canDownload = Boolean(decision.markdown.trim());

  return (
    <div className="grid gap-4">
      <ResultBox title="Status">
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">
            {decision.status || "Status not provided"}
          </p>
          {shouldShowDocumentLinks(decision.status) && decision.documentLinks.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Document
              </div>
              <ul className="space-y-1 text-sm">
                {decision.documentLinks.map((doc, index) => (
                  <li key={`${doc.label}-${index}`}>
                    {doc.href ? (
                      <a
                        href={doc.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {doc.label}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">{doc.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </ResultBox>

      <ResultBox
        title={decision.markdownLabel}
        action={
          <Button
            size="sm"
            className="gap-1.5"
            disabled={!canDownload}
            onClick={() => setGenOpen(true)}
          >
            <FileText className="h-4 w-4" />
            Generate Document
          </Button>
        }
      >
        {canDownload ? (
          <MarkdownAnswer markdown={decision.markdown} showToc framed={false} />
        ) : (
          <p className="text-sm text-muted-foreground">No markdown content provided.</p>
        )}
      </ResultBox>

      <ResultBox title="Warnings">
        {decision.warnings.length > 0 ? (
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {decision.warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No warnings.</p>
        )}
      </ResultBox>

      <GenerateDocumentDialog
        open={genOpen}
        onOpenChange={setGenOpen}
        productName={component}
        query={query}
        aiText={decision.markdown}
        component=""
        mode="direct"
        limit={0}
        providedMarkdown={decision.markdown}
        providedTitle={documentTitle}
      />
    </div>
  );
}

function ResultBox({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.9em] text-slate-950"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return part;
  });
}

function renderCodeWithHighlight(code: string) {
  const tokenPattern =
    /(\/\/.*|#[^\n]*|\b(?:from|import|as|const|let|var|function|return|export|if|else|for|while|class|def|async|await|settings|env)\b|"[^"]*"|'[^']*'|`[^`]*`|\b\d+(?:\.\d+)?\b|[A-Z_][A-Z0-9_]*(?=\b)|[A-Za-z_][\w.-]*(?=\s*:)|[A-Za-z_][\w]*(?=\s*\())/g;
  const parts = code.split(tokenPattern);

  return parts.map((part, index) => {
    if (!part) return null;

    if (/^(\/\/|#).*/.test(part)) {
      return (
        <span key={index} className="text-zinc-400">
          {part}
        </span>
      );
    }

    if (/^["'`]/.test(part)) {
      return (
        <span key={index} className="text-blue-700">
          {part}
        </span>
      );
    }

    if (
      /^\b(?:from|import|as|const|let|var|function|return|export|if|else|for|while|class|def|async|await)\b$/.test(
        part,
      )
    ) {
      return (
        <span key={index} className="font-medium text-pink-600">
          {part}
        </span>
      );
    }

    if (/^\b(?:settings|env)\b$/.test(part) || /^[A-Za-z_][\w.-]*(?=\s*:)/.test(part)) {
      return (
        <span key={index} className="text-green-700">
          {part}
        </span>
      );
    }

    if (/^[A-Z_][A-Z0-9_]*$/.test(part)) {
      return (
        <span key={index} className="text-sky-700">
          {part}
        </span>
      );
    }

    if (/^[A-Za-z_][\w]*$/.test(part)) {
      return (
        <span key={index} className="text-purple-700">
          {part}
        </span>
      );
    }

    if (/^\d+$/.test(part)) {
      return (
        <span key={index} className="text-cyan-700">
          {part}
        </span>
      );
    }

    return part;
  });
}

function slugifyHeading(value: string) {
  return stripMarkdown(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function stripMarkdown(value: string) {
  return value.replace(/\*\*/g, "").replace(/`/g, "");
}

function getStandardTimeframe(fromDate: string, toDate: string) {
  if (fromDate && toDate) return { fromDate, toDate };
  return null;
}

function toBackendPayload(request: UiRagRequest): BackendRagPayload {
  return {
    query_text: request.queryText,
    repo_id: request.repoId,
    limit: request.limit,
    type: request.type,
    ...(request.type === "standard" && request.fromDate && request.toDate
      ? { from_date: request.fromDate, to_date: request.toDate }
      : {}),
  };
}

function buildCurlEquivalent(payload: BackendRagPayload, endpoint: UiRagRequest["endpoint"]) {
  const path = endpoint === "generate-doc" ? "/api/v1/rag-go/generate-doc" : "/api/v1/rag-go";
  return [
    `curl -X POST "http://infer.hawk-llm.ai${path}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '${JSON.stringify(payload, null, 2)}'`,
  ].join("\n");
}

function TimeframePicker({
  fromDate,
  toDate,
  disabled = false,
  onChange,
}: {
  fromDate: string;
  toDate: string;
  disabled?: boolean;
  onChange: (fromDate: string, toDate: string) => void;
}) {
  const selectedFrom = parseDateValue(fromDate);
  const selectedTo = parseDateValue(toDate);
  const label =
    fromDate && toDate ? `${formatDateLabel(fromDate)} - ${formatDateLabel(toDate)}` : "Timeframe";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="h-10 w-[168px] justify-start gap-2 px-3 font-normal disabled:opacity-50"
        >
          <CalendarIcon className="h-4 w-4" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-3">
        <Calendar
          mode="range"
          numberOfMonths={2}
          defaultMonth={new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)}
          disabled={{ after: new Date() }}
          selected={
            selectedFrom || selectedTo
              ? {
                  from: selectedFrom,
                  to: selectedTo,
                }
              : undefined
          }
          onSelect={(range) => {
            onChange(
              range?.from ? toDateValue(range.from) : "",
              range?.to ? toDateValue(range.to) : "",
            );
          }}
        />
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            {fromDate && toDate ? `${fromDate} to ${toDate}` : "Select from and to dates"}
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("", "")}>
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function parseDateValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(value: string) {
  const date = parseDateValue(value);
  if (!date) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function UnsupportedProduct({ productName }: { productName?: string | undefined }) {
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

function EmptyState({ onPick }: { onPick: (example: ExamplePrompt) => void }) {
  return (
    <div className="relative mx-auto mt-16 max-w-2xl text-center">
      <div className="mx-auto mb-4 flex h-24 w-32 items-center justify-center">
        <img src={orcLogo} alt="" aria-hidden="true" className="h-24 w-32 object-contain" />
      </div>
      <h2 className="text-lg font-semibold">Ask AI about your code and docs</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Try a BlazeMeter component prompt to get started
      </p>
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {EXAMPLE_PROMPTS.map((example) => (
          <button
            key={example.prompt}
            onClick={() => onPick(example)}
            className="rounded-lg border border-border bg-card px-4 py-3 text-left text-sm text-foreground transition-colors hover:border-foreground/20 hover:bg-accent"
          >
            {example.prompt}
          </button>
        ))}
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
  component,
  mode,
  limit,
  fromDate = "",
  toDate = "",
  providedMarkdown,
  providedTitle,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productName: string;
  query: string;
  aiText: string;
  component: ComponentName | "";
  mode: "standard" | "direct";
  limit: number;
  fromDate?: string;
  toDate?: string;
  providedMarkdown?: string;
  providedTitle?: string;
}) {
  const [title, setTitle] = useState("");
  const [lastAutoTitle, setLastAutoTitle] = useState("");
  const [hasCustomTitle, setHasCustomTitle] = useState(false);
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState("");
  const ragSearch = useServerFn(runRagSearch);

  useEffect(() => {
    if (!open) return;

    const nextTitle = providedTitle || generateDocumentTitle(query, aiText, component || productName);

    if (!hasCustomTitle) {
      setTitle(nextTitle);
      setLastAutoTitle(nextTitle);
    }
  }, [open, productName, query, aiText, component, hasCustomTitle, providedTitle]);

  const handleGenerate = async () => {
    const resolvedTitle =
      title.trim() ||
      lastAutoTitle ||
      providedTitle ||
      generateDocumentTitle(query, aiText, component || productName);

    if (!query.trim()) {
      setDocError("Enter a query before generating a document.");
      return;
    }

    const immediateMarkdown = (providedMarkdown || aiText || "").trim();
    if (immediateMarkdown) {
      const markdown = addTitleToMarkdown(resolvedTitle, immediateMarkdown);
      downloadMarkdownDocument(resolvedTitle, markdown);
      onOpenChange(false);
      return;
    }

    if (!component) {
      setDocError("Select a component before generating a document.");
      return;
    }

    setDocLoading(true);
    setDocError("");

    try {
      const timeframe = mode === "standard" ? getStandardTimeframe(fromDate, toDate) : null;
      const requestPayload = {
        queryText: query.trim(),
        repoId: REPO_ID_BY_COMPONENT[component],
        type: mode,
        limit,
        endpoint: "generate-doc",
        ...(timeframe ? { fromDate: timeframe.fromDate, toDate: timeframe.toDate } : {}),
        // bust cache to force fresh server-fn invocation
        bustCache: Date.now(),
      } as const;
      const finalPayload = toBackendPayload(requestPayload);
      console.info("[RAG UI document final payload]", finalPayload);
      console.info("[RAG UI document curl equivalent]", buildCurlEquivalent(finalPayload, "generate-doc"));

      const data = await ragSearch({
        data: requestPayload,
      });

      console.info("[RAG UI raw generate-doc response]", data);
      const generatedAnswer = normalizeRagAnswer(data);
      const generatedDoc = parseDocDecisionResponse(generatedAnswer);
      const markdown = addTitleToMarkdown(resolvedTitle, generatedDoc.markdown || generatedAnswer);
      downloadMarkdownDocument(resolvedTitle, markdown);
      onOpenChange(false);
    } catch (e) {
      setDocError(e instanceof Error ? e.message : "Failed to generate document.");
    } finally {
      setDocLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Document</DialogTitle>
          <DialogDescription>Create a document from the current search results.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="doc-title">Document Title</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setHasCustomTitle(true);
              }}
              placeholder="e.g. Using K6 Executor in Taurus"
            />
          </div>

          {docError && <p className="text-sm text-destructive">{docError}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={docLoading}>
            {docLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Generate Document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function generateDocumentTitle(query: string, aiText: string, fallback: string) {
  const heading = aiText
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("# "));

  const source = heading?.replace(/^#\s+/, "") || query || fallback;
  return source
    .replace(/[?!.]+$/g, "")
    .split(/\s+/)
    .slice(0, 12)
    .map((word) => {
      if (/^[A-Z0-9-]{2,}$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function addTitleToMarkdown(title: string, markdown: string) {
  const content = markdown.trim();
  if (content.startsWith("# ")) return content;
  return `# ${title}\n\n${content}`;
}

function normalizeRagAnswer(answer: unknown) {
  if (typeof answer === "string") return answer;
  return JSON.stringify(answer ?? "", null, 2);
}

function rawAnswerText(answer: unknown) {
  return typeof answer === "string" ? answer : normalizeRagAnswer(answer);
}

function getDisplayMarkdown(value: string) {
  const decision = parseDocDecisionResponse(value);
  return decision.status || decision.markdown ? decision.markdown || value : value;
}

function parseDocDecisionResponse(value: string, repoId = ""): DocDecisionResponse {
  const parsed = parseJsonLike(value);

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const record = parsed as any;
    const markdownField = findDocMarkdownField(record);

    if (!markdownField.markdown && record.answer !== undefined) {
      return parseDocDecisionResponse(normalizeRagAnswer(record.answer), repoId);
    }

    return {
      status: stringValue(record.status),
      documentLinks: findDocumentLinks(record, repoId),
      markdownLabel: markdownField.label,
      markdown: markdownField.markdown,
      warnings: arrayOfStrings(record.warnings),
    };
  }

  return {
    status: "",
    documentLinks: [],
    markdownLabel: "changes_markdown",
    markdown: value,
    warnings: [],
  };
}

function shouldShowDocumentLinks(status: string) {
  return status === "update_required" || status === "no_changes_required";
}

function findDocumentLinks(record: any, repoId: string): DocumentLink[] {
  const docs = [
    ...arrayOfObjects(record.matched_docs),
    ...arrayOfObjects(record.matchedDocs),
    ...arrayOfObjects(record.documents),
    ...arrayOfObjects(record.docs),
  ];
  const targetDocRef = stringValue(objectValue(record.delta)?.target_doc_ref);
  const links = docs
    .map((doc) => {
      const rawHref =
        stringValue(doc.url) ||
        stringValue(doc.link) ||
        stringValue(doc.href) ||
        stringValue(doc.html_url) ||
        stringValue(doc.htmlUrl) ||
        stringValue(doc.web_url) ||
        stringValue(doc.webUrl) ||
        stringValue(doc.document_url) ||
        stringValue(doc.documentUrl) ||
        stringValue(doc.document_link) ||
        stringValue(doc.documentLink) ||
        stringValue(doc.source_url) ||
        stringValue(doc.sourceUrl) ||
        stringValue(doc.doc_url) ||
        stringValue(doc.docUrl);
      const docRef =
        stringValue(doc.doc_ref) ||
        stringValue(doc.docRef) ||
        stringValue(doc.path) ||
        stringValue(doc.file_path) ||
        stringValue(doc.filePath);
      const href = normalizeDocumentHref(rawHref) || buildRepoDocumentHref(repoId, docRef);
      const label = stringValue(doc.title) || docRef || href;

      if (!label) return null;
      return href ? { label, href } : { label };
    })
    .filter(Boolean) as DocumentLink[];

  if (links.length > 0) return dedupeDocumentLinks(links);

  if (!targetDocRef) return [];
  const targetHref = buildRepoDocumentHref(repoId, targetDocRef);
  return [targetHref ? { label: targetDocRef, href: targetHref } : { label: targetDocRef }];

}

function normalizeDocumentHref(href: string) {
  if (!href) return "";
  if (/^https?:\/\//i.test(href)) return href;
  return "";
}

function buildRepoDocumentHref(repoId: string, docRef: string) {
  if (!repoId || !docRef) return undefined;
  const normalizedRepo = repoId.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const normalizedDocRef = docRef.replace(/^\/+/, "");

  if (!normalizedRepo.startsWith("github.com/")) return undefined;

  return `https://${normalizedRepo}/blob/HEAD/${encodeURI(normalizedDocRef)}`;
}

function findDocMarkdownField(record: any): {
  label: "changes_markdown" | "body_markdown";
  markdown: string;
} {
  const containers = [
    record,
    objectValue(record.delta),
    objectValue(record.document),
    objectValue(record.result),
  ].filter(Boolean) as any[];

  for (const container of containers) {
    const changesMarkdown =
      stringValue(container.changes_markdown) || stringValue(container.changesMarkdown);
    if (changesMarkdown) {
      return { label: "changes_markdown", markdown: changesMarkdown };
    }

    const bodyMarkdown =
      stringValue(container.body_markdown) || stringValue(container.bodyMarkdown);
    if (bodyMarkdown) {
      return { label: "body_markdown", markdown: bodyMarkdown };
    }
  }

  return { label: "changes_markdown", markdown: "" };
}

function parseJsonLike(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (!fenced) return null;

    try {
      return JSON.parse(fenced[1] ?? "");
    } catch {
      return null;
    }
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function objectValue(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as any;
  }

  return null;
}

function arrayOfObjects(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is any =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item),
  ) as any[];
}

function dedupeDocumentLinks(links: DocumentLink[]) {
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.label}:${link.href ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function arrayOfStrings(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
      .filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) return [value];

  return [];
}

function downloadMarkdownDocument(title: string, markdown: string) {
  const html = buildFormattedDocumentHtml(title, markdown);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slugify(title)}.html`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildFormattedDocumentHtml(title: string, markdown: string) {
  const parsed = parseMarkdownForDocument(markdown);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color: #18181b;
      background: #ffffff;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    body {
      margin: 0;
      background: #ffffff;
    }
    .page {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 280px;
      gap: 48px;
      max-width: 1440px;
      margin: 0 auto;
      padding: 40px 48px 64px;
    }
    article {
      min-width: 0;
      font-size: 18px;
      line-height: 1.8;
    }
    h1 {
      margin: 0 0 24px;
      font-size: 34px;
      line-height: 1.2;
      font-weight: 750;
    }
    h2 {
      margin: 36px 0 14px;
      font-size: 26px;
      line-height: 1.25;
      font-weight: 750;
    }
    h3 {
      margin: 28px 0 12px;
      font-size: 21px;
      line-height: 1.35;
      font-weight: 750;
    }
    p {
      margin: 14px 0;
    }
    ul, ol {
      margin: 16px 0;
      padding-left: 30px;
    }
    li {
      margin: 8px 0;
    }
    code.inline-code {
      border-radius: 6px;
      background: #f1f1f3;
      padding: 2px 7px;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 0.92em;
    }
    pre {
      margin: 22px 0;
      overflow-x: auto;
      border: 1px solid #dedee3;
      border-radius: 8px;
      background: #f7f7f8;
      box-shadow: 0 1px 4px rgba(24, 24, 27, 0.12);
      padding: 22px 26px;
      font-size: 17px;
      line-height: 1.65;
    }
    pre code {
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      color: #18181b;
      white-space: pre;
    }
    .tok-comment { color: #a1a1aa; }
    .tok-string { color: #1d4ed8; }
    .tok-keyword { color: #db2777; font-weight: 600; }
    .tok-key { color: #15803d; }
    .tok-constant { color: #0369a1; }
    .tok-number { color: #0891b2; }
    .tok-call { color: #7e22ce; }
    aside {
      border-left: 1px solid #e4e4e7;
      padding-left: 24px;
    }
    nav {
      position: sticky;
      top: 24px;
      max-height: calc(100vh - 48px);
      overflow: auto;
    }
    .toc-title {
      margin-bottom: 18px;
      color: #71717a;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .toc-link {
      display: block;
      color: #0f7dcc;
      text-decoration: none;
      border-radius: 6px;
      padding: 7px 8px;
      font-size: 16px;
      line-height: 1.35;
    }
    .toc-link:hover {
      background: #f4f4f5;
    }
    .toc-link.level-3,
    .toc-link.level-4 {
      margin-left: 18px;
      font-size: 14px;
    }
    @media (max-width: 900px) {
      .page {
        display: block;
        padding: 28px 22px 44px;
      }
      aside {
        display: none;
      }
      article {
        font-size: 16px;
      }
      pre {
        font-size: 14px;
      }
    }
  </style>
</head>
<body>
  <main class="page">
    <article>
${parsed.body}
    </article>
    ${
      parsed.headings.length > 0
        ? `<aside>
      <nav>
        <div class="toc-title">Sections</div>
${parsed.headings
  .map(
    (heading) =>
      `        <a class="toc-link level-${heading.level}" href="#${heading.id}">${escapeHtml(
        heading.text,
      )}</a>`,
  )
  .join("\n")}
      </nav>
    </aside>`
        : ""
    }
  </main>
</body>
</html>`;
}

function parseMarkdownForDocument(markdown: string) {
  const lines = markdown.split("\n");
  const body: string[] = [];
  const headings: { id: string; text: string; level: number }[] = [];
  let listItems: string[] = [];
  let orderedItems: string[] = [];
  let codeLines: string[] = [];
  let inCodeBlock = false;

  const flushList = () => {
    if (listItems.length > 0) {
      body.push(
        "<ul>",
        ...listItems.map((item) => `  <li>${renderInlineMarkdownHtml(item)}</li>`),
        "</ul>",
      );
      listItems = [];
    }

    if (orderedItems.length > 0) {
      body.push(
        "<ol>",
        ...orderedItems.map((item) => `  <li>${renderInlineMarkdownHtml(item)}</li>`),
        "</ol>",
      );
      orderedItems = [];
    }
  };

  const flushCodeBlock = () => {
    body.push(`<pre><code>${renderCodeWithHighlightHtml(codeLines.join("\n"))}</code></pre>`);
    codeLines = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        flushCodeBlock();
        inCodeBlock = false;
      } else {
        flushList();
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }

    if (!trimmed) {
      flushList();
      return;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushList();
      const level = heading[1]!.length;
      const headingText = heading[2]!;
      const id = `${slugifyHeading(headingText)}-${headings.length}`;
      headings.push({ id, text: stripMarkdown(headingText), level });
      body.push(`<h${level} id="${id}">${renderInlineMarkdownHtml(headingText)}</h${level}>`);
      return;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      orderedItems = [];
      listItems.push(bullet[1]!);
      return;
    }

    const numbered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (numbered) {
      listItems = [];
      orderedItems.push(numbered[1]!);
      return;
    }

    flushList();
    body.push(`<p>${renderInlineMarkdownHtml(trimmed)}</p>`);
  });

  flushList();
  if (inCodeBlock) flushCodeBlock();

  return { body: body.join("\n"), headings };
}

function renderInlineMarkdownHtml(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts
    .map((part) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return `<strong>${escapeHtml(part.slice(2, -2))}</strong>`;
      }

      if (part.startsWith("`") && part.endsWith("`")) {
        return `<code class="inline-code">${escapeHtml(part.slice(1, -1))}</code>`;
      }

      return escapeHtml(part);
    })
    .join("");
}

function renderCodeWithHighlightHtml(code: string) {
  const tokenPattern =
    /(\/\/.*|#[^\n]*|\b(?:from|import|as|const|let|var|function|return|export|if|else|for|while|class|def|async|await|settings|env)\b|"[^"]*"|'[^']*'|`[^`]*`|\b\d+(?:\.\d)?\b|[A-Z_][A-Z0-9_]*(?=\b)|[A-Za-z_][\w.-]*(?=\s*:)|[A-Za-z_][\w]*(?=\s*\())/g;

  return code
    .split(tokenPattern)
    .map((part) => {
      if (!part) return "";
      const escaped = escapeHtml(part);

      if (/^(\/\/|#).*/.test(part)) return `<span class="tok-comment">${escaped}</span>`;
      if (/^["'`]/.test(part)) return `<span class="tok-string">${escaped}</span>`;
      if (
        /^\b(?:from|import|as|const|let|var|function|return|export|if|else|for|while|class|def|async|await)\b$/.test(
          part,
        )
      ) {
        return `<span class="tok-keyword">${escaped}</span>`;
      }
      if (/^\b(?:settings|env)\b$/.test(part) || /^[A-Za-z_][\w.-]*(?=\s*:)/.test(part)) {
        return `<span class="tok-key">${escaped}</span>`;
      }
      if (/^[A-Z_][A-Z0-9_]*$/.test(part)) return `<span class="tok-constant">${escaped}</span>`;
      if (/^\d+(\.\d+)?$/.test(part)) return `<span class="tok-number">${escaped}</span>`;
      if (/^[A-Za-z_][\w]*$/.test(part)) return `<span class="tok-call">${escaped}</span>`;
      return escaped;
    })
    .join("");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
