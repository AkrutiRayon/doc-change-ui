import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getProduct } from "@/data/products";
import { runRagSearch } from "@/lib/rag.functions";
import { Loader2 } from "lucide-react";

import {
  ArrowLeft,
  Search,
  Sparkles,
  FileText,
  Download,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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

const COMPONENTS = ["Taurus", "Crane", "MCP"] as const;
const TEAMS = ["Titans", "Sparta", "Atlas", "Phoenix"];
const LIMITS = [10, 15, 20, 25, 30, 35, 40, 45, 50];
const REPO_ID_BY_COMPONENT: Record<(typeof COMPONENTS)[number], string> = {
  Taurus: "github.com/Blazemeter/taurus",
  Crane: "github.com/Blazemeter/helm-crane",
  MCP: "github.com/Blazemeter/bzm-mcp",
};

const EXAMPLE_PROMPTS = [
  "What changed in authentication last month?",
  "Show API updates for OAuth.",
  "Summarize documentation updates from Team Titans.",
  "Generate release notes for Portal changes.",
];

type ComponentName = (typeof COMPONENTS)[number];

function Workspace() {
  const { productId } = Route.useParams();
  const product = getProduct(productId);
  const isSupportedProduct = product?.id === "blazemeter";
  const productName = product?.name ?? "Product";
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"standard" | "direct">("standard");
  const [team, setTeam] = useState<string>("");
  const [component, setComponent] = useState<ComponentName | "">("");
  const [limit, setLimit] = useState(15);
  const [hasSearched, setHasSearched] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [aiText, setAiText] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string>("");
  const ragSearch = useServerFn(runRagSearch);

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
    try {
      const data = await ragSearch({
        data: {
          queryText: query.trim(),
          repoId: REPO_ID_BY_COMPONENT[component],
          type: mode,
          limit,
          endpoint: "search",
        },
      });
      setAiText(data.answer);
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
              <SelectTrigger className="h-10 w-[150px]">
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

            <Select
              value={String(limit)}
              onValueChange={(value) => setLimit(Number(value))}
            >
              <SelectTrigger className="h-10 w-[95px]">
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

            <Button
              aria-label="Search"
              onClick={handleSearch}
              className="h-10 w-10 p-0"
              disabled={aiLoading}
            >
              {aiLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Results */}
        <section className="mt-6">
          {!hasSearched ? (
            <EmptyState onPick={(p) => setQuery(p)} />
          ) : (
            <>
              <div className="mb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" />
                    {mode === "standard" ? "AI Release Summary" : "AI Answer"}
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
                <div className="mt-2">
                  {aiLoading ? (
                    <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating {mode === "standard" ? "release summary" : "answer"}…
                    </p>
                  ) : aiError ? (
                    <p className="text-sm text-destructive">{aiError}</p>
                  ) : aiText ? (
                    <MarkdownAnswer markdown={aiText} />
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
        limit={limit}
      />
    </div>
  );
}

function MarkdownAnswer({ markdown }: { markdown: string }) {
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
        <ul key={`ul-${blocks.length}`} className="my-3 list-disc space-y-1 pl-6">
          {listItems.map((item, index) => (
            <li key={index}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>,
      );
      listItems = [];
    }

    if (orderedItems.length > 0) {
      blocks.push(
        <ol key={`ol-${blocks.length}`} className="my-3 list-decimal space-y-1 pl-6">
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
        className="my-5 overflow-hidden rounded-lg border border-border bg-[#f7f7f8] shadow-sm"
      >
        <pre className="overflow-x-auto px-5 py-4 text-[15px] leading-7">
          <code className="font-mono text-foreground">
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
      const level = heading[1].length;
      const headingText = heading[2];
      const headingId = `${slugifyHeading(headingText)}-${headings.length}`;
      headings.push({ id: headingId, text: stripMarkdown(headingText), level });
      const content = renderInlineMarkdown(headingText);
      if (level === 1) {
        blocks.push(
          <h1 id={headingId} key={`h-${blocks.length}`} className="mb-3 mt-4 scroll-mt-20 text-2xl font-semibold">
            {content}
          </h1>,
        );
      } else if (level === 2) {
        blocks.push(
          <h2 id={headingId} key={`h-${blocks.length}`} className="mb-2 mt-5 scroll-mt-20 text-xl font-semibold">
            {content}
          </h2>,
        );
      } else {
        blocks.push(
          <h3 id={headingId} key={`h-${blocks.length}`} className="mb-2 mt-4 scroll-mt-20 text-base font-semibold">
            {content}
          </h3>,
        );
      }
      return;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      orderedItems = [];
      listItems.push(bullet[1]);
      return;
    }

    const numbered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (numbered) {
      listItems = [];
      orderedItems.push(numbered[1]);
      return;
    }

    flushList();
    blocks.push(
      <p key={`p-${blocks.length}`} className="my-2">
        {renderInlineMarkdown(trimmed)}
      </p>,
    );
  });

  flushList();
  if (inCodeBlock) flushCodeBlock();

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
      <article className="min-w-0 text-base leading-8 text-foreground">{blocks}</article>
      {headings.length > 0 && (
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
          className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]"
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

    if (/^\b(?:from|import|as|const|let|var|function|return|export|if|else|for|while|class|def|async|await)\b$/.test(part)) {
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

function GenerateDocumentDialog({
  open,
  onOpenChange,
  productName,
  query,
  aiText,
  component,
  mode,
  limit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productName: string;
  query: string;
  aiText: string;
  component: ComponentName | "";
  mode: "standard" | "direct";
  limit: number;
}) {
  const [title, setTitle] = useState("");
  const [lastAutoTitle, setLastAutoTitle] = useState("");
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState("");
  const ragSearch = useServerFn(runRagSearch);

  useEffect(() => {
    if (!open) return;

    const nextTitle = generateDocumentTitle(query, aiText, component || productName);

    if (!title || title === lastAutoTitle) {
      setTitle(nextTitle);
      setLastAutoTitle(nextTitle);
    }
  }, [open, productName, query, title, lastAutoTitle]);

  const handleGenerate = async () => {
    if (!query.trim()) {
      setDocError("Enter a query before generating a document.");
      return;
    }

    if (!component) {
      setDocError("Select a component before generating a document.");
      return;
    }

    const documentTitle = title.trim() || lastAutoTitle || generateDocumentTitle(query, aiText, component);
    setDocLoading(true);
    setDocError("");

    try {
      const data = await ragSearch({
        data: {
          queryText: query.trim(),
          repoId: REPO_ID_BY_COMPONENT[component],
          type: mode,
          limit,
          endpoint: "generate-doc",
        },
      });

      const markdown = addTitleToMarkdown(documentTitle, data.answer);
      downloadFormattedDocument(documentTitle, markdown);
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

function downloadFormattedDocument(title: string, markdown: string) {
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
    body.push(
      `<pre><code>${renderCodeWithHighlightHtml(codeLines.join("\n"))}</code></pre>`,
    );
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
      const level = heading[1].length;
      const headingText = heading[2];
      const id = `${slugifyHeading(headingText)}-${headings.length}`;
      headings.push({ id, text: stripMarkdown(headingText), level });
      body.push(
        `<h${level} id="${id}">${renderInlineMarkdownHtml(headingText)}</h${level}>`,
      );
      return;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      orderedItems = [];
      listItems.push(bullet[1]);
      return;
    }

    const numbered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (numbered) {
      listItems = [];
      orderedItems.push(numbered[1]);
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
      if (/^\b(?:from|import|as|const|let|var|function|return|export|if|else|for|while|class|def|async|await)\b$/.test(part)) {
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
