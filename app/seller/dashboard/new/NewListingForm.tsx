"use client";

import { useEffect, useRef, useState } from "react";
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

const MAX_PHOTOS = 6;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

export function NewListingForm() {
  const router = useRouter();
  const supabase = createClient();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  /*
   * Clean up temporary browser preview URLs.
   */
  useEffect(() => {
    return () => {
      photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoPreviews]);

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files ?? []);

    /*
     * Reset the actual input so the seller can select
     * the same file again later if they removed it.
     */
    e.target.value = "";

    if (selectedFiles.length === 0) {
      return;
    }

    const validFiles = selectedFiles.filter(
      (file) => file.size <= MAX_PHOTO_SIZE,
    );

    const oversizedCount = selectedFiles.length - validFiles.length;

    /*
     * Avoid adding the exact same local file twice.
     */
    const newFiles = validFiles.filter(
      (newFile) =>
        !photos.some(
          (existingFile) =>
            existingFile.name === newFile.name &&
            existingFile.size === newFile.size &&
            existingFile.lastModified === newFile.lastModified,
        ),
    );

    const remainingSlots = MAX_PHOTOS - photos.length;

    if (remainingSlots <= 0) {
      setError(`You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }

    const filesToAdd = newFiles.slice(0, remainingSlots);

    if (filesToAdd.length > 0) {
      setPhotos((current) => [...current, ...filesToAdd]);

      setPhotoPreviews((current) => [
        ...current,
        ...filesToAdd.map((file) => URL.createObjectURL(file)),
      ]);
    }

    if (oversizedCount > 0) {
      setError(
        `${oversizedCount} photo${
          oversizedCount === 1 ? " was" : "s were"
        } skipped because ${
          oversizedCount === 1 ? "it is" : "they are"
        } larger than 5MB.`,
      );

      return;
    }

    if (newFiles.length > remainingSlots) {
      setError(
        `Only ${MAX_PHOTOS} photos are allowed. The first ${MAX_PHOTOS} were kept.`,
      );

      return;
    }

    if (newFiles.length === 0 && validFiles.length > 0) {
      setError("That photo has already been added.");
      return;
    }

    setError(null);
  }

  function removePhoto(index: number) {
    setPhotoPreviews((current) => {
      const preview = current[index];

      if (preview) {
        URL.revokeObjectURL(preview);
      }

      return current.filter((_, i) => i !== index);
    });

    setPhotos((current) => current.filter((_, i) => i !== index));

    setError(null);
  }

  function movePhotoToCover(index: number) {
    if (index === 0) {
      return;
    }

    setPhotos((current) => {
      const updated = [...current];
      const [selected] = updated.splice(index, 1);

      updated.unshift(selected);

      return updated;
    });

    setPhotoPreviews((current) => {
      const updated = [...current];
      const [selected] = updated.splice(index, 1);

      updated.unshift(selected);

      return updated;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError(null);

    const cleanTitle = title.trim();
    const cleanDescription = description.trim();

    const numericPrice = Number(price);
    const numericStock = Number(stock);

    if (photos.length === 0) {
      setError("Add at least one product photo.");
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
     * AUTHENTICATION
     */

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);

      router.push("/login?redirect=/seller/dashboard/new");

      return;
    }

    /*
     * GENERAL ACCOUNT CHECK
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
     * SELLER CHECK
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
     *
     * photos[0] is always the cover.
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
     * Never leave a public listing without a photo.
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
        {/* PHOTOS */}

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Photos</label>

            <span className="text-xs text-gray-500">
              {photos.length}/{MAX_PHOTOS}
            </span>
          </div>

          {photoPreviews.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {photoPreviews.map((src, index) => (
                <div key={src} className="relative">
                  <button
                    type="button"
                    onClick={() => movePhotoToCover(index)}
                    className="block w-full"
                    aria-label={
                      index === 0 ? "Cover photo" : "Make this the cover photo"
                    }
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`Selected product photo ${index + 1}`}
                      className="w-full aspect-square object-cover rounded-lg border"
                      style={{
                        borderColor:
                          index === 0 ? "var(--indigo)" : "var(--sand)",
                      }}
                    />
                  </button>

                  {index === 0 && (
                    <span
                      className="absolute left-2 bottom-2 rounded-full px-2 py-1 text-[10px] font-semibold text-white"
                      style={{
                        background: "var(--indigo)",
                      }}
                    >
                      Cover
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    aria-label={`Remove photo ${index + 1}`}
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white border flex items-center justify-center shadow-sm"
                    style={{
                      borderColor: "var(--sand)",
                      color: "var(--ink)",
                    }}
                  >
                    <CloseIcon />
                  </button>
                </div>
              ))}
            </div>
          )}

          {photos.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-lg border border-dashed px-4 py-4 text-sm font-medium flex items-center justify-center gap-2"
              style={{
                borderColor: "var(--sand)",
                color: "var(--indigo)",
              }}
            >
              <PhotoIcon />

              {photos.length === 0 ? "Add product photos" : "Add more photos"}
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoSelect}
            className="hidden"
          />

          <p className="text-xs text-gray-500 mt-2">
            Add up to 6 photos. You can select several at once or add them one
            by one. Tap a photo to make it the cover.
          </p>
        </div>

        {/* TITLE */}

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

        {/* DESCRIPTION */}

        <div>
          <label className="text-sm font-medium block mb-1">Description</label>

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

        {/* PRICE + STOCK */}

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

        {/* CATEGORY */}

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

        {/* CONDITION */}

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

        {/* LOCATION */}

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

        {/* ERROR */}

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

        {/* SUBMIT */}

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
  );
}

function PhotoIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />

      <circle cx="8.5" cy="9" r="1.5" />

      <path d="m21 15-5-5L5 20" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
