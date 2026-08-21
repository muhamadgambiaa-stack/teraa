"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CONDITION_LABELS, type ProductCondition } from "@/types/database";

export interface ProductCardData {
  id: string;
  title: string;
  price: number;
  condition: ProductCondition;
  location_city: string;
  coverPhoto: string | null;
  sellerName: string | null;
  sellerVerified: boolean;
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const supabase = createClient();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("favorites")
        .select("id")
        .eq("buyer_id", user.id)
        .eq("product_id", product.id)
        .maybeSingle();
      if (active && data) setSaved(true);
    })();
    return () => {
      active = false;
    };
  }, [supabase, product.id]);

  async function toggleSave(e: React.MouseEvent) {
    e.preventDefault();
    if (pending) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    setPending(true);
    if (saved) {
      await supabase.from("favorites").delete().eq("buyer_id", user.id).eq("product_id", product.id);
      setSaved(false);
    } else {
      await supabase.from("favorites").insert({ buyer_id: user.id, product_id: product.id });
      setSaved(true);
    }
    setPending(false);
  }

  return (
    <div className="group relative rounded-xl border bg-white overflow-hidden transition-shadow hover:shadow-md" style={{ borderColor: "var(--sand)" }}>
      <Link href={`/products/${product.id}`} className="block">
        <div className="aspect-square relative" style={{ background: "var(--sand)" }}>
          {product.coverPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.coverPhoto}
              alt={product.title}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
              No photo
            </div>
          )}

          {product.condition !== "new" && (
            <span
              className="absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
              style={{ background: "var(--indigo)" }}
            >
              {CONDITION_LABELS[product.condition]}
            </span>
          )}
        </div>

        <div className="p-3">
          <p className="text-sm font-medium leading-snug line-clamp-2 min-h-[2.5em]">
            {product.title}
          </p>
          <p className="text-base font-bold mt-1.5" style={{ color: "var(--clay)" }}>
            GMD {Number(product.price).toLocaleString()}
          </p>
          <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
              <path d="M12 21s-7-6.4-7-11.5A7 7 0 0 1 19 9.5C19 14.6 12 21 12 21z" />
              <circle cx="12" cy="9.5" r="2.5" />
            </svg>
            <span>{product.location_city}</span>
          </div>
          {product.sellerName && (
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 truncate">
              <span className="truncate">{product.sellerName}</span>
              {product.sellerVerified && (
                <span
                  className="shrink-0 inline-flex items-center gap-0.5 font-medium"
                  style={{ color: "var(--leaf)" }}
                  title="ID-verified seller"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l2.4 1.9 3-.5 1.1 2.9 2.9 1.1-.5 3L23 12l-1.9 2.4.5 3-2.9 1.1-1.1 2.9-3-.5L12 23l-2.4-1.9-3 .5-1.1-2.9-2.9-1.1.5-3L1 12l1.9-2.4-.5-3 2.9-1.1L6.4 2.6l3 .5L12 2z" />
                    <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
            </p>
          )}
        </div>
      </Link>

      <button
        onClick={toggleSave}
        aria-label={saved ? "Remove from favorites" : "Save to favorites"}
        aria-pressed={saved}
        disabled={pending}
        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-sm disabled:opacity-60"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill={saved ? "var(--clay)" : "none"}
          stroke={saved ? "var(--clay)" : "#6b6b63"}
          strokeWidth="2"
        >
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
        </svg>
      </button>
    </div>
  );
}
