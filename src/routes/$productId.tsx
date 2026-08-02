import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SubscribeModal } from "@/components/SubscribeModal";
import { getProduct, updatesByProduct, type DocTag } from "@/data/products";

export const Route = createFileRoute("/$productId")({
  loader: ({ params }) => {
    const product = getProduct(params.productId);
    if (!product) throw notFound();
    return { product, updates: updatesByProduct[product.id] ?? [] };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Unavailable — Doc Changes Tracker" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const title = `${loaderData.product.name} Documentation Updates — Doc Changes Tracker`;
    const description = `Track and subscribe to ${loaderData.product.name} documentation changes: added pages, updates, critical notices and release notes.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ProductPage,
});

const TABS: { id: "all" | DocTag; label: string }[] = [
  { id: "all", label: "All" },
  { id: "added", label: "Added" },
  { id: "updated", label: "Updated" },
  { id: "critical", label: "Critical" },
  { id: "release_notes", label: "Release Notes" },
];

const RANGES = [
  { id: "1", label: "24h" },
  { id: "7", label: "7d" },
  { id: "30", label: "30d" },
];

function ProductPage() {
  const { product, updates } = Route.useLoaderData();
  const [tab, setTab] = useState<"all" | DocTag>("all");
  const [days, setDays] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return updates.filter((u) => {
      if (tab !== "all" && u.tag !== tab) return false;
      if (days) {
        const cutoff = Date.now() - Number(days) * 86400000;
        if (new Date(u.createdAt).getTime() < cutoff) return false;
      }
      if (q && !(u.title + u.whatChanged).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [updates, tab, days, search]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl px-6 pb-24 pt-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to products
        </Link>

        <div className="mt-6 flex flex-col gap-6 rounded-xl border border-border bg-card p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <img
              src={product.logo}
              alt={`${product.name} logo`}
              className="h-14 w-14 object-contain"
            />
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{product.name}</h2>
              <p className="text-sm text-muted-foreground">{product.description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.27 21a2 2 0 0 0 3.46 0" />
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
            </svg>
            Subscribe to updates
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setDays(days === r.id ? null : r.id)}
                className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                  days === r.id
                    ? "border-foreground bg-primary text-primary-foreground"
                    : "border-border hover:bg-accent"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            type="text"
            placeholder="Search updates..."
            aria-label="Search updates"
            className="ml-auto w-full min-w-56 max-w-xs rounded-lg border border-border bg-card px-4 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground"
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-1 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-4">
          {visible.map((u) => {
            const isLong = u.whatChanged.length > 180;
            const isOpen = expanded[u.id];
            return (
              <article
                key={u.id}
                className="rounded-xl border border-border bg-card p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-base font-semibold">{u.title}</h3>
                  <span className="shrink-0 rounded-full border border-border px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {u.tag.replace("_", " ")}
                  </span>
                </div>
                <p
                  className={`mt-3 text-sm text-muted-foreground ${
                    isLong && !isOpen ? "line-clamp-2" : ""
                  }`}
                >
                  {u.whatChanged}
                </p>
                {isLong && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((s) => ({ ...s, [u.id]: !s[u.id] }))
                    }
                    className="mt-2 text-sm font-medium underline underline-offset-4"
                  >
                    {isOpen ? "Show less" : "Read more"}
                  </button>
                )}
                <div className="mt-4 flex items-center justify-between gap-4">
                  <time className="text-xs text-muted-foreground">
                    {new Date(u.createdAt).toLocaleString()}
                  </time>
                  <a
                    href={u.link}
                    target="_blank"
                    rel="noopener"
                    className="rounded-lg border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-accent"
                  >
                    Open document
                  </a>
                </div>
              </article>
            );
          })}

          {visible.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              No updates found for the selected filters.
            </p>
          )}
        </div>
      </main>

      <SubscribeModal
        open={open}
        onClose={() => setOpen(false)}
        productName={product.name}
      />
    </div>
  );
}
