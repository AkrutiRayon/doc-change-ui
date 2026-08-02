import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { products } from "@/data/products";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Doc Changes Tracker — Product Documentation Updates" },
      {
        name: "description",
        content:
          "Subscribe to documentation changes across products. Stay informed about new features, breaking changes, and updates.",
      },
      { property: "og:title", content: "Doc Changes Tracker" },
      {
        property: "og:description",
        content:
          "Subscribe to documentation changes across products and stay informed about new features and breaking changes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      (p.name + p.description + p.category).toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-10">
        <div className="relative mx-auto max-w-3xl">
          <svg
            className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="text"
            placeholder="Search products..."
            aria-label="Search products"
            className="w-full rounded-xl border border-border bg-card py-4 pl-14 pr-5 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground"
          />
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Link
              key={p.id}
              to="/$productId"
              params={{ productId: p.id }}
              className="group flex items-start gap-4 rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-foreground hover:shadow-lg"
            >
              <img
                src={p.logo}
                alt={`${p.name} logo`}
                loading="lazy"
                className="h-12 w-12 shrink-0 object-contain"
              />
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold tracking-tight">{p.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                <span className="mt-3 inline-block rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                  {p.category}
                </span>
              </div>
              <svg
                className="mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Link>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="mt-16 text-center text-sm text-muted-foreground">
            No products match "{query}".
          </p>
        )}
      </main>
    </div>
  );
}
