"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GAMBIA_CITIES, CONDITION_LABELS, type ProductCondition } from "@/types/database";

interface CategoryOption {
  id: string;
  name: string;
}

export function NewListingForm() {
  const router = useRouter();
  const supabase = createClient();

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [categoryId, setCategoryId] = useState("");
  const [condition, setCondition] = useState<ProductCondition>("new");
  const [city, setCity] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("categories")
      .select("id, name")
      .is("parent_category_id", null)
      .order("name")
      .then(({ data }) => setCategories(data ?? []));
  }, [supabase]);

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 6);
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB, keeps uploads workable on slow connections
    const oversized = files.filter((f) => f.size > MAX_SIZE);

    if (oversized.length > 0) {
      setError(`${oversized.length} photo${oversized.length > 1 ? "s are" : " is"} over 5MB. Use smaller photos so uploads don't time out on slow connections.`);
      const validFiles = files.filter((f) => f.size <= MAX_SIZE);
      setPhotos(validFiles);
      setPhotoPreviews(validFiles.map((f) => URL.createObjectURL(f)));
      return;
    }

    setError(null);
    setPhotos(files);
    setPhotoPreviews(files.map((f) => URL.createObjectURL(f)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (photos.length === 0) {
      setError("Add at least one photo. Listings without photos get far fewer buyers.");
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("You need to be logged in.");
      setLoading(false);
      return;
    }

    // 1. Create the product row
    const { data: product, error: productError } = await supabase
      .from("products")
      .insert({
        seller_id: user.id,
        category_id: categoryId || null,
        title,
        description,
        price: Number(price),
        stock_quantity: Number(stock),
        condition,
        location_city: city,
        status: "active",
      })
      .select("id")
      .single();

    if (productError || !product) {
      setError(productError?.message ?? "Couldn't create listing.");
      setLoading(false);
      return;
    }

    // 2. Upload photos to storage, then insert product_photos rows
    for (let i = 0; i < photos.length; i++) {
      const file = photos[i];
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${product.id}/${i}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("product-photos")
        .upload(path, file);

      if (uploadError) {
        setError(`Listing created, but photo ${i + 1} failed to upload: ${uploadError.message}`);
        continue;
      }

      const { data: urlData } = supabase.storage.from("product-photos").getPublicUrl(path);

      await supabase.from("product_photos").insert({
        product_id: product.id,
        photo_url: urlData.publicUrl,
        sort_order: i,
        is_cover: i === 0,
      });
    }

    setLoading(false);
    router.push("/seller/dashboard");
    router.refresh();
  }

  return (
    <>
      <main className="max-w-lg mx-auto px-4 py-6">
        <h1 className="font-display text-xl mb-6" style={{ color: "var(--ink)" }}>
          New listing
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Photos */}
          <div>
            <label className="text-sm font-medium block mb-1">Photos (up to 6)</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoSelect}
              className="w-full text-sm rounded-lg border px-3 py-2"
              style={{ borderColor: "var(--sand)" }}
            />
            {photoPreviews.length > 0 && (
              <div className="grid grid-cols-6 gap-2 mt-2">
                {photoPreviews.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={src}
                    alt=""
                    className="aspect-square object-cover rounded-md border"
                    style={{ borderColor: "var(--sand)" }}
                  />
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">The first photo is your cover image.</p>
          </div>

          {/* Title */}
          <div>
            <label className="text-sm font-medium block mb-1">Title</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Samsung Galaxy A15, 128GB, sealed box"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
              style={{ borderColor: "var(--sand)" }}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium block mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe the item: condition details, what's included, why you're selling…"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 resize-none"
              style={{ borderColor: "var(--sand)" }}
            />
          </div>

          {/* Price + stock */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Price (GMD)</label>
              <input
                required
                type="number"
                min="0"
                inputMode="numeric"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                style={{ borderColor: "var(--sand)" }}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Quantity in stock</label>
              <input
                required
                type="number"
                min="1"
                inputMode="numeric"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                style={{ borderColor: "var(--sand)" }}
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="text-sm font-medium block mb-1">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 bg-white"
              style={{ borderColor: "var(--sand)" }}
            >
              <option value="">Select a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Condition */}
          <div>
            <label className="text-sm font-medium block mb-2">Condition</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(CONDITION_LABELS) as ProductCondition[]).map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setCondition(c)}
                  className="rounded-lg border py-2 text-xs"
                  style={{
                    borderColor: condition === c ? "var(--indigo)" : "var(--sand)",
                    background: condition === c ? "var(--indigo)" : "white",
                    color: condition === c ? "white" : "var(--ink)",
                  }}
                >
                  {CONDITION_LABELS[c]}
                </button>
              ))}
            </div>
          </div>

          {/* City */}
          <div>
            <label className="text-sm font-medium block mb-1">Location</label>
            <select
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 bg-white"
              style={{ borderColor: "var(--sand)" }}
            >
              <option value="">Select your city</option>
              {GAMBIA_CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-2.5 text-white text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--indigo)" }}
          >
            {loading ? "Publishing…" : "Publish listing"}
          </button>
        </form>
      </main>
    </>
  );
}
