import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import { GAMBIA_CITIES } from "@/types/database";

import {
  hideListing,
  reactivateListing,
  requestListingReview,
  updateListing,
} from "./actions";

export default async function ManageListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/seller/dashboard/products/${id}`);
  }

  const { data: product, error } = await supabase
    .from("products")
    .select(
      `
      id,
      seller_id,
      category_id,
      title,
      description,
      price,
      stock_quantity,
      status,
      condition,
      location_city,
      moderation_reason,
      moderated_at,

      product_photos(
        photo_url,
        is_cover
      )
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !product) {
    notFound();
  }

  if (product.seller_id !== user.id) {
    redirect("/seller/dashboard");
  }

  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select(
      `
      id,
      name
      `,
    )
    .is("parent_category_id", null)
    .order("name", {
      ascending: true,
    });

  if (categoriesError) {
    console.error("Could not load categories:", categoriesError);
  }

  const { data: appeals, error: appealsError } = await supabase
    .from("listing_appeals")
    .select(
      `
      id,
      message,
      status,
      admin_response,
      created_at,
      reviewed_at
      `,
    )
    .eq("product_id", product.id)
    .eq("seller_id", user.id)
    .order("created_at", {
      ascending: false,
    })
    .limit(10);

  if (appealsError) {
    console.error("Could not load listing appeals:", appealsError);
  }

  const latestAppeal = appeals?.[0] ?? null;

  const pendingAppeal =
    appeals?.find((appeal) => appeal.status === "pending") ?? null;

  const photos =
    (
      product as {
        product_photos?: {
          photo_url: string;
          is_cover: boolean;
        }[];
      }
    ).product_photos ?? [];

  const cover =
    photos.find((photo) => photo.is_cover)?.photo_url ?? photos[0]?.photo_url;

  const isHidden = product.status === "hidden";

  const isOutOfStock = product.status === "out_of_stock";

  const isAdminHidden = product.status === "admin_hidden";

  return (
    <>
      <SiteHeader />

      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 sm:pb-8">
        <div className="flex items-start justify-between gap-4 mb-7">
          <div>
            <Link
              href="/seller/dashboard"
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:underline"
            >
              <ArrowLeftIcon />
              Seller dashboard
            </Link>

            <h1
              className="font-display text-2xl sm:text-3xl mt-2"
              style={{
                color: "var(--ink)",
              }}
            >
              Manage listing
            </h1>

            <p className="text-sm text-gray-500 mt-1">
              Update your product, category, stock, price or listing visibility.
            </p>
          </div>

          <ListingStatus status={product.status} />
        </div>

        {cover && (
          <div className="mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover}
              alt={product.title}
              className="w-full max-h-64 object-contain rounded-xl border bg-white"
              style={{
                borderColor: "var(--sand)",
              }}
            />
          </div>
        )}

        {isAdminHidden && (
          <div
            className="rounded-xl border p-5 mb-6"
            style={{
              borderColor: "var(--clay)",
              background: "#fdf0f0",
            }}
          >
            <p
              className="font-semibold"
              style={{
                color: "var(--clay)",
              }}
            >
              Listing removed by Teraa
            </p>

            <p className="text-sm text-gray-700 mt-2">
              This listing is not visible to buyers because it was removed
              through Teraa&apos;s moderation process.
            </p>

            {product.moderation_reason && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase text-gray-500">
                  Reason
                </p>

                <p className="text-sm mt-1">{product.moderation_reason}</p>
              </div>
            )}

            {product.moderated_at && (
              <p className="text-xs text-gray-500 mt-3">
                Removed on {new Date(product.moderated_at).toLocaleDateString()}
              </p>
            )}

            <p className="text-xs text-gray-500 mt-4">
              You can edit the listing to correct the issue. You cannot
              reactivate it yourself.
            </p>
          </div>
        )}

        {isAdminHidden && pendingAppeal && (
          <div
            className="rounded-xl border p-5 mb-6"
            style={{
              borderColor: "var(--gold)",
              background: "#fbf3df",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">Review request pending</p>

                <p className="text-sm text-gray-700 mt-1">
                  Teraa has received your request to review this listing again.
                </p>
              </div>

              <span
                className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
                style={{
                  background: "#fff",
                  color: "var(--gold)",
                }}
              >
                Pending
              </span>
            </div>

            <div className="mt-4">
              <p className="text-xs font-semibold uppercase text-gray-500">
                Your message
              </p>

              <p className="text-sm mt-1">{pendingAppeal.message}</p>
            </div>

            <p className="text-xs text-gray-500 mt-4">
              Submitted {new Date(pendingAppeal.created_at).toLocaleString()}
            </p>
          </div>
        )}

        {isAdminHidden &&
          !pendingAppeal &&
          latestAppeal &&
          latestAppeal.status === "rejected" && (
            <div
              className="rounded-xl border p-5 mb-6"
              style={{
                borderColor: "var(--clay)",
                background: "#fdf0f0",
              }}
            >
              <p className="font-semibold">
                Previous review request was rejected
              </p>

              {latestAppeal.admin_response && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase text-gray-500">
                    Teraa&apos;s response
                  </p>

                  <p className="text-sm mt-1">{latestAppeal.admin_response}</p>
                </div>
              )}

              <p className="text-xs text-gray-500 mt-4">
                You may correct the remaining issue and submit another review
                request.
              </p>
            </div>
          )}

        {latestAppeal &&
          latestAppeal.status === "approved" &&
          !isAdminHidden && (
            <div
              className="rounded-xl border p-4 mb-6 text-sm"
              style={{
                borderColor: "var(--leaf)",
                background: "#e3f0e8",
              }}
            >
              <p className="font-semibold">Listing restored</p>

              <p className="text-gray-700 mt-1">
                Teraa approved your review request and restored this listing.
              </p>

              {latestAppeal.admin_response && (
                <p className="mt-2">{latestAppeal.admin_response}</p>
              )}
            </div>
          )}

        {!isAdminHidden && isOutOfStock && (
          <div
            className="rounded-xl border p-4 mb-6 text-sm"
            style={{
              borderColor: "var(--gold)",
              background: "#fbf3df",
            }}
          >
            <p className="font-semibold mb-1">This product is out of stock</p>

            <p className="text-gray-600">
              Increase the stock quantity below and Teraa will automatically
              make the listing active again.
            </p>
          </div>
        )}

        {!isAdminHidden && isHidden && (
          <div
            className="rounded-xl border p-4 mb-6 text-sm"
            style={{
              borderColor: "var(--sand)",
              background: "#f5f5f5",
            }}
          >
            <p className="font-semibold mb-1">This listing is hidden</p>

            <p className="text-gray-600">
              Buyers cannot see it on the homepage or in search results.
            </p>
          </div>
        )}

        <section
          className="rounded-xl border bg-white p-4 sm:p-5"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          <h2 className="font-semibold mb-1">Listing details</h2>

          <p className="text-xs text-gray-500 mb-5">
            Update the information buyers see on this listing.
          </p>

          <form
            action={updateListing.bind(null, product.id)}
            className="space-y-5"
          >
            <div>
              <label className="block text-sm font-medium mb-1">
                Product title
              </label>

              <input
                name="title"
                required
                maxLength={150}
                defaultValue={product.title}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
                style={{
                  borderColor: "var(--sand)",
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Description
              </label>

              <textarea
                name="description"
                required
                maxLength={5000}
                rows={5}
                defaultValue={product.description ?? ""}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none resize-y"
                style={{
                  borderColor: "var(--sand)",
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Category</label>

              <select
                name="category_id"
                required
                defaultValue={product.category_id ?? ""}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none bg-white"
                style={{
                  borderColor: "var(--sand)",
                }}
              >
                <option value="">Select a category</option>

                {(categories ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>

              {categoriesError && (
                <p className="text-xs text-red-600 mt-1">
                  Categories could not be loaded. Refresh the page before
                  saving.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Price (GMD)
                </label>

                <input
                  name="price"
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  defaultValue={Number(product.price)}
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
                  style={{
                    borderColor: "var(--sand)",
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Stock quantity
                </label>

                <input
                  name="stock_quantity"
                  type="number"
                  required
                  min="0"
                  step="1"
                  defaultValue={product.stock_quantity}
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
                  style={{
                    borderColor: "var(--sand)",
                  }}
                />

                {product.stock_quantity === 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Increase this number to restock the product.
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Condition
              </label>

              <select
                name="condition"
                required
                defaultValue={product.condition}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none bg-white"
                style={{
                  borderColor: "var(--sand)",
                }}
              >
                <option value="new">Brand new</option>

                <option value="used">Used</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Location</label>

              <select
                name="location_city"
                required
                defaultValue={product.location_city}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none bg-white"
                style={{
                  borderColor: "var(--sand)",
                }}
              >
                <option value="">Select your city</option>

                {GAMBIA_CITIES.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="w-full rounded-full py-3 text-white text-sm font-medium"
              style={{
                background: "var(--indigo)",
              }}
            >
              Save changes
            </button>
          </form>
        </section>

        {isAdminHidden && !pendingAppeal && (
          <section
            className="border-t mt-8 pt-6"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <h2 className="font-semibold mb-2">Request another review</h2>

            <p className="text-sm text-gray-500 mb-4">
              First correct the issue described above. Then explain what you
              changed and ask Teraa to review the listing again.
            </p>

            <form
              action={requestListingReview.bind(null, product.id)}
              className="space-y-3"
            >
              <textarea
                name="message"
                required
                minLength={10}
                maxLength={2000}
                rows={4}
                placeholder="Example: I updated the description and removed the misleading information. Please review the listing again."
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none resize-y"
                style={{
                  borderColor: "var(--sand)",
                }}
              />

              <button
                type="submit"
                className="rounded-full px-5 py-2.5 text-white text-sm font-medium"
                style={{
                  background: "var(--indigo)",
                }}
              >
                Request review
              </button>
            </form>
          </section>
        )}

        <section
          className="border-t mt-8 pt-6"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          <h2 className="font-semibold mb-2">Listing visibility</h2>

          {isAdminHidden ? (
            <div
              className="rounded-lg border p-4 text-sm"
              style={{
                borderColor: "var(--clay)",
                background: "#fdf0f0",
              }}
            >
              <p className="font-medium">
                This listing cannot be reactivated by the seller.
              </p>

              <p className="text-gray-600 mt-1">
                Submit a review request above after correcting the issue.
              </p>
            </div>
          ) : !isHidden ? (
            <>
              <p className="text-sm text-gray-500 mb-4">
                Hiding a listing removes it from the marketplace without
                deleting its order history.
              </p>

              <form action={hideListing.bind(null, product.id)}>
                <button
                  type="submit"
                  className="rounded-full border px-5 py-2 text-sm font-medium"
                  style={{
                    borderColor: "var(--clay)",
                    color: "var(--clay)",
                  }}
                >
                  Hide listing
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4">
                This listing was hidden by you. You may make it available again.
              </p>

              <form action={reactivateListing.bind(null, product.id)}>
                <button
                  type="submit"
                  className="rounded-full px-5 py-2 text-white text-sm font-medium"
                  style={{
                    background: "var(--leaf)",
                  }}
                >
                  Reactivate listing
                </button>
              </form>
            </>
          )}
        </section>

        {appeals && appeals.length > 0 && (
          <section
            className="border-t mt-8 pt-6"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <h2 className="font-semibold mb-3">Review history</h2>

            <div className="space-y-2">
              {appeals.map((appeal) => (
                <div
                  key={appeal.id}
                  className="rounded-lg border p-3 bg-white"
                  style={{
                    borderColor: "var(--sand)",
                  }}
                >
                  <div className="flex justify-between gap-3">
                    <span
                      className="text-xs font-semibold capitalize"
                      style={{
                        color:
                          appeal.status === "approved"
                            ? "var(--leaf)"
                            : appeal.status === "rejected"
                              ? "var(--clay)"
                              : "var(--gold)",
                      }}
                    >
                      {appeal.status}
                    </span>

                    <span className="text-xs text-gray-400">
                      {new Date(appeal.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-sm mt-2">{appeal.message}</p>

                  {appeal.admin_response && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-gray-500">
                        Teraa response
                      </p>

                      <p className="text-sm mt-1">{appeal.admin_response}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}

function ListingStatus({ status }: { status: string }) {
  const styles: Record<
    string,
    {
      label: string;
      bg: string;
      color: string;
    }
  > = {
    active: {
      label: "Active",
      bg: "#e3f0e8",
      color: "var(--leaf)",
    },

    out_of_stock: {
      label: "Out of stock",
      bg: "#fbf3df",
      color: "var(--gold)",
    },

    hidden: {
      label: "Hidden",
      bg: "#eeeeee",
      color: "#666",
    },

    admin_hidden: {
      label: "Removed by Teraa",
      bg: "#fdf0f0",
      color: "var(--clay)",
    },
  };

  const style = styles[status] ?? styles.hidden;

  return (
    <span
      className="rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap"
      style={{
        background: style.bg,
        color: style.color,
      }}
    >
      {style.label}
    </span>
  );
}

function ArrowLeftIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}
