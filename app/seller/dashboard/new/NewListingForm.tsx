"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import {
  GAMBIA_CITIES,
  CONDITION_LABELS,
  type ProductCondition,
} from "@/types/database";

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
      .then(({ data }) => {
        setCategories(data ?? []);
      });
  }, [supabase]);

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 6);

    const MAX_SIZE = 5 * 1024 * 1024;

    const oversized = files.filter((file) => file.size > MAX_SIZE);

    if (oversized.length > 0) {
      setError(
        `${oversized.length} photo${
          oversized.length > 1 ? "s are" : " is"
        } over 5MB. Use smaller photos so uploads don't time out on slow connections.`,
      );

      const validFiles = files.filter((file) => file.size <= MAX_SIZE);

      setPhotos(validFiles);

      setPhotoPreviews(validFiles.map((file) => URL.createObjectURL(file)));

      return;
    }

    setError(null);
    setPhotos(files);

    setPhotoPreviews(files.map((file) => URL.createObjectURL(file)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError(null);

    /*
     * Basic form validation.
     */
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();

    const numericPrice = Number(price);
    const numericStock = Number(stock);

    if (photos.length === 0) {
      setError(
        "Add at least one photo. Listings without photos get far fewer buyers.",
      );
      return;
    }

    if (!cleanTitle) {
      setError("Enter a product title.");
      return;
    }

    if (!cleanDescription) {
      setError("Enter a product description.");
      return;
    }

    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setError("Enter a valid price.");
      return;
    }

    if (!Number.isInteger(numericStock) || numericStock < 1) {
      setError("Stock quantity must be at least 1.");
      return;
    }

    if (!categoryId) {
      setError("Select a category.");
      return;
    }

    if (!city) {
      setError("Select your location.");
      return;
    }

    setLoading(true);

    /*
     * Authentication.
     */
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You need to be logged in.");

      setLoading(false);

      router.push("/login?redirect=/seller/dashboard/new");

      return;
    }

    /*
     * GENERAL USER ACCOUNT CHECK
     *
     * This prevents restricted, suspended and
     * banned marketplace accounts from creating
     * new listings.
     */
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select(
        `
        id,
        account_status
        `,
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      setError("Could not verify your Teraa account.");

      setLoading(false);
      return;
    }

    if (profile.account_status !== "active") {
      setLoading(false);

      router.push("/account/status");

      return;
    }

    /*
     * SELLER ACCOUNT CHECK
     *
     * Seller must:
     *
     * - exist
     * - be active
     * - be approved
     *
     * before publishing new listings.
     */
    const { data: seller, error: sellerError } = await supabase
      .from("sellers")
      .select(
        `
        id,
        verification_status,
        account_status
        `,
      )
      .eq("id", user.id)
      .maybeSingle();

    if (sellerError || !seller) {
      setError("Seller account could not be found.");

      setLoading(false);
      return;
    }

    if (seller.account_status !== "active") {
      setError(
        "Your seller account is not currently active. You cannot publish new listings.",
      );

      setLoading(false);
      return;
    }

    if (seller.verification_status !== "approved") {
      setError(
        "Your seller account must be approved before you can publish listings.",
      );

      setLoading(false);
      return;
    }

    /*
     * CREATE PRODUCT
     *
     * Price and seller ID come from our validated
     * values rather than trusting anything hidden
     * in the form.
     */
    const { data: product, error: productError } = await supabase
      .from("products")
      .insert({
        seller_id: user.id,

        category_id: categoryId,

        title: cleanTitle,

        description: cleanDescription,

        price: numericPrice,

        stock_quantity: numericStock,

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

    /*
     * UPLOAD PHOTOS
     */
    let successfulUploads = 0;

    for (let i = 0; i < photos.length; i++) {
      const file = photos[i];

      const originalExtension =
        file.name.split(".").pop()?.toLowerCase() ?? "jpg";

      const safeExtension =
        originalExtension.replace(/[^a-z0-9]/g, "") || "jpg";

      const path = `${user.id}/${product.id}/${i}.${safeExtension}`;

      const { error: uploadError } = await supabase.storage
        .from("product-photos")
        .upload(path, file, {
          upsert: false,
        });

      if (uploadError) {
        console.error(`Photo ${i + 1} upload failed:`, uploadError);

        continue;
      }

      const { data: urlData } = supabase.storage
        .from("product-photos")
        .getPublicUrl(path);

      const { error: photoRowError } = await supabase
        .from("product_photos")
        .insert({
          product_id: product.id,

          photo_url: urlData.publicUrl,

          sort_order: i,

          is_cover: successfulUploads === 0,
        });

      if (photoRowError) {
        console.error(`Photo ${i + 1} database record failed:`, photoRowError);

        continue;
      }

      successfulUploads++;
    }

    /*
     * Don't leave a public listing with zero
     * successfully attached photos.
     */
    if (successfulUploads === 0) {
      const { error: hideError } = await supabase
        .from("products")
        .update({
          status: "hidden",
        })
        .eq("id", product.id);

      if (hideError) {
        console.error("Could not hide photo-less listing:", hideError);
      }

      setError(
        "The listing was created, but the photos could not be uploaded. The listing has been hidden. Open it from your seller dashboard and try again.",
      );

      setLoading(false);
      return;
    }

    setLoading(false);

    router.push("/seller/dashboard");

    router.refresh();
  }

  return (
    <>
      <main className="max-w-lg mx-auto px-4 py-6">
        <h1
          className="font-display text-xl mb-6"
          style={{
            color: "var(--ink)",
          }}
        >
          New listing
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Photos */}

          <div>
            <label className="text-sm font-medium block mb-1">
              Photos (up to 6)
            </label>

            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoSelect}
              className="w-full text-sm rounded-lg border px-3 py-2"
              style={{
                borderColor: "var(--sand)",
              }}
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
                    style={{
                      borderColor: "var(--sand)",
                    }}
                  />
                ))}
              </div>
            )}

            <p className="text-xs text-gray-500 mt-1">
              The first successfully uploaded photo becomes your cover image.
            </p>
          </div>

          {/* Title */}

          <div>
            <label className="text-sm font-medium block mb-1">Title</label>

            <input
              required
              maxLength={150}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Samsung Galaxy A15, 128GB, sealed box"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
              style={{
                borderColor: "var(--sand)",
              }}
            />
          </div>

          {/* Description */}

          <div>
            <label className="text-sm font-medium block mb-1">
              Description
            </label>

            <textarea
              required
              maxLength={5000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe the item: condition details, what's included, why you're selling…"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 resize-none"
              style={{
                borderColor: "var(--sand)",
              }}
            />
          </div>

          {/* Price + stock */}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">
                Price (GMD)
              </label>

              <input
                required
                type="number"
                min="1"
                step="0.01"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                style={{
                  borderColor: "var(--sand)",
                }}
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-1">
                Quantity in stock
              </label>

              <input
                required
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                style={{
                  borderColor: "var(--sand)",
                }}
              />
            </div>
          </div>

          {/* Category */}

          <div>
            <label className="text-sm font-medium block mb-1">Category</label>

            <select
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 bg-white"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              <option value="">Select a category</option>

              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Condition */}

          <div>
            <label className="text-sm font-medium block mb-2">Condition</label>

            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(CONDITION_LABELS) as ProductCondition[]).map(
                (option) => (
                  <button
                    type="button"
                    key={option}
                    onClick={() => setCondition(option)}
                    className="rounded-lg border py-2 text-xs"
                    style={{
                      borderColor:
                        condition === option ? "var(--indigo)" : "var(--sand)",

                      background:
                        condition === option ? "var(--indigo)" : "white",

                      color: condition === option ? "white" : "var(--ink)",
                    }}
                  >
                    {CONDITION_LABELS[option]}
                  </button>
                ),
              )}
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
              style={{
                borderColor: "var(--sand)",
              }}
            >
              <option value="">Select your city</option>

              {GAMBIA_CITIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div
              className="rounded-lg p-3 text-sm text-red-700"
              style={{
                background: "#fdf0f0",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-2.5 text-white text-sm font-medium disabled:opacity-50"
            style={{
              background: "var(--indigo)",
            }}
          >
            {loading ? "Publishing…" : "Publish listing"}
          </button>
        </form>
      </main>
    </>
  );
}
