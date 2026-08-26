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

    async function loadFavorite() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      const { data } = await supabase
        .from("favorites")
        .select("id")
        .eq("buyer_id", user.id)
        .eq("product_id", product.id)
        .maybeSingle();

      if (active) {
        setSaved(Boolean(data));
      }
    }

    loadFavorite();

    return () => {
      active = false;
    };
  }, [supabase, product.id]);

  async function toggleSave(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (pending) {
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push(`/login?redirect=/products/${product.id}`);
      return;
    }

    setPending(true);

    if (saved) {
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("buyer_id", user.id)
        .eq("product_id", product.id);

      if (!error) {
        setSaved(false);
      }
    } else {
      const { error } = await supabase.from("favorites").insert({
        buyer_id: user.id,
        product_id: product.id,
      });

      if (!error) {
        setSaved(true);
      }
    }

    setPending(false);
  }

  return (
    <article
      className="group relative rounded-lg sm:rounded-xl border bg-white overflow-hidden hover:shadow-md transition-shadow"
      style={{
        borderColor: "var(--sand)",
      }}
    >
      <Link href={`/products/${product.id}`} className="block">
        {/* IMAGE */}

        <div
          className="aspect-square relative overflow-hidden"
          style={{
            background: "var(--sand)",
          }}
        >
          {product.coverPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.coverPhoto}
              alt={product.title}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[11px] text-gray-400">
              No photo
            </div>
          )}

          {product.condition !== "new" && (
            <span
              className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 rounded-full px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold text-white"
              style={{
                background: "var(--indigo)",
              }}
            >
              {CONDITION_LABELS[product.condition]}
            </span>
          )}
        </div>

        {/* DETAILS */}

        <div className="p-2 sm:p-3">
          <p className="text-[12px] sm:text-sm font-medium leading-snug line-clamp-2 min-h-[2.3em]">
            {product.title}
          </p>

          <p
            className="text-sm sm:text-base font-bold mt-1"
            style={{
              color: "var(--clay)",
            }}
          >
            GMD {Number(product.price).toLocaleString()}
          </p>

          <div className="flex items-center gap-1 mt-1 text-[10px] sm:text-xs text-gray-500 min-w-0">
            <LocationIcon />

            <span className="truncate">{product.location_city}</span>
          </div>

          {product.sellerName && (
            <div className="flex items-center gap-1 mt-1 min-w-0">
              <p className="text-[10px] sm:text-xs text-gray-500 truncate">
                {product.sellerName}
              </p>

              {product.sellerVerified && <VerifiedIcon />}
            </div>
          )}
        </div>
      </Link>

      {/* FAVORITE */}

      <button
        type="button"
        onClick={toggleSave}
        aria-label={saved ? "Remove from favorites" : "Save to favorites"}
        aria-pressed={saved}
        disabled={pending}
        className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-sm disabled:opacity-60"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill={saved ? "var(--clay)" : "none"}
          stroke={saved ? "var(--clay)" : "#6b7280"}
          strokeWidth="2"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"
          />
        </svg>
      </button>
    </article>
  );
}

function LocationIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="shrink-0"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"
      />

      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function VerifiedIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="shrink-0"
      style={{
        color: "var(--leaf)",
      }}
      aria-label="Verified seller"
    >
      <path d="M12 2l2.4 1.9 3-.5 1.1 2.9 2.9 1.1-.5 3L23 12l-1.9 2.4.5 3-2.9 1.1-1.1 2.9-3-.5L12 23l-2.4-1.9-3 .5-1.1-2.9-2.9-1.1.5-3L1 12l1.9-2.4-.5-3 2.9-1.1L6.4 2.6l3 .5L12 2Z" />

      <path
        d="m9 12 2 2 4-4"
        stroke="white"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
