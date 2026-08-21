"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { GAMBIA_CITIES } from "@/types/database";

export function SearchBar({ initialQuery }: { initialQuery?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    router.push(`/search?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex-1 max-w-lg">
      <div className="relative">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search phones, dresses, rice, generators…"
          className="w-full rounded-full border pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2"
          style={{ borderColor: "var(--sand)" }}
        />
      </div>
    </form>
  );
}

export function FilterBar({
  cities,
  activeCity,
  activeCondition,
  activeSort,
  activeMinPrice,
  activeMaxPrice,
}: {
  cities?: readonly string[];
  activeCity?: string;
  activeCondition?: string;
  activeSort?: string;
  activeMinPrice?: string;
  activeMaxPrice?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [minPrice, setMinPrice] = useState(activeMinPrice ?? "");
  const [maxPrice, setMaxPrice] = useState(activeMaxPrice ?? "");

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/search?${params.toString()}`);
  }

  function applyPriceRange(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (minPrice) params.set("min", minPrice); else params.delete("min");
    if (maxPrice) params.set("max", maxPrice); else params.delete("max");
    router.push(`/search?${params.toString()}`);
  }

  const cityList = cities ?? GAMBIA_CITIES;

  return (
    <div className="flex flex-wrap gap-2 items-center text-sm">
      <select
        value={activeCity ?? ""}
        onChange={(e) => updateParam("city", e.target.value)}
        className="rounded-full border px-3 py-1.5 text-xs bg-white outline-none"
        style={{ borderColor: "var(--sand)" }}
      >
        <option value="">All locations</option>
        {cityList.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <select
        value={activeCondition ?? ""}
        onChange={(e) => updateParam("condition", e.target.value)}
        className="rounded-full border px-3 py-1.5 text-xs bg-white outline-none"
        style={{ borderColor: "var(--sand)" }}
      >
        <option value="">New or used</option>
        <option value="new">Brand new</option>
        <option value="used_like_new">Used, like new</option>
        <option value="used_good">Used, good condition</option>
        <option value="used_fair">Used, fair condition</option>
      </select>

      <form onSubmit={applyPriceRange} className="flex items-center gap-1">
        <input
          type="number"
          inputMode="numeric"
          placeholder="Min GMD"
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value)}
          className="w-24 rounded-full border px-3 py-1.5 text-xs bg-white outline-none"
          style={{ borderColor: "var(--sand)" }}
        />
        <span className="text-gray-400 text-xs">–</span>
        <input
          type="number"
          inputMode="numeric"
          placeholder="Max GMD"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          className="w-24 rounded-full border px-3 py-1.5 text-xs bg-white outline-none"
          style={{ borderColor: "var(--sand)" }}
        />
        <button
          type="submit"
          className="rounded-full px-3 py-1.5 text-xs font-medium text-white"
          style={{ background: "var(--indigo)" }}
        >
          Go
        </button>
      </form>

      <select
        value={activeSort ?? ""}
        onChange={(e) => updateParam("sort", e.target.value)}
        className="rounded-full border px-3 py-1.5 text-xs bg-white outline-none"
        style={{ borderColor: "var(--sand)" }}
      >
        <option value="">Newest first</option>
        <option value="price_asc">Price: low to high</option>
        <option value="price_desc">Price: high to low</option>
      </select>
    </div>
  );
}
