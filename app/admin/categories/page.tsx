import Link from "next/link";

import { SiteHeader } from "@/components/SiteHeader";
import { requireAdmin } from "@/lib/require-admin";

import {
  createCategory,
  deleteCategory,
  renameCategory,
} from "./actions";

type Category = {
  id: string;
  name: string;
  parent_category_id: string | null;
};

export default async function AdminCategoriesPage() {
  const { supabase } = await requireAdmin();

  const [
    { data: categoryData, error: categoryError },
    { data: productData },
  ] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, parent_category_id")
      .is("parent_category_id", null)
      .order("name"),

    supabase
      .from("products")
      .select("category_id"),
  ]);

  if (categoryError) {
    throw new Error("Could not load marketplace categories.");
  }

  const categories = (categoryData ?? []) as Category[];

  const productCounts = new Map<string, number>();

  for (const product of productData ?? []) {
    if (!product.category_id) {
      continue;
    }

    productCounts.set(
      product.category_id,
      (productCounts.get(product.category_id) ?? 0) + 1,
    );
  }

  return (
    <>
      <SiteHeader />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 sm:pb-8">
        <div className="mb-6">
          <Link
            href="/admin"
            className="text-xs font-medium hover:underline"
            style={{
              color: "var(--indigo)",
            }}
          >
            ← Admin
          </Link>

          <h1
            className="font-display text-2xl mt-3"
            style={{
              color: "var(--ink)",
            }}
          >
            Categories
          </h1>

          <p className="text-sm text-gray-500 mt-1">
            Manage the categories sellers can choose when publishing products.
          </p>
        </div>

        <section
          className="rounded-xl border bg-white p-4 mb-6"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          <h2 className="font-semibold text-sm mb-3">
            Add category
          </h2>

          <form
            action={createCategory}
            className="flex flex-col sm:flex-row gap-2"
          >
            <input
              name="name"
              required
              minLength={2}
              maxLength={60}
              placeholder="e.g. Computers & Laptops"
              className="flex-1 rounded-lg border px-3 py-2.5 text-sm outline-none"
              style={{
                borderColor: "var(--sand)",
              }}
            />

            <button
              type="submit"
              className="rounded-lg px-5 py-2.5 text-sm font-medium text-white"
              style={{
                background: "var(--indigo)",
              }}
            >
              Add category
            </button>
          </form>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">
              Marketplace categories
            </h2>

            <span className="text-xs text-gray-500">
              {categories.length} total
            </span>
          </div>

          {categories.length === 0 ? (
            <div
              className="rounded-xl border bg-white p-8 text-center"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              <p className="font-medium">
                No categories yet
              </p>

              <p className="text-sm text-gray-500 mt-1">
                Add the first marketplace category above.
              </p>
            </div>
          ) : (
            <div
              className="rounded-xl border bg-white overflow-hidden"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              {categories.map((category) => {
                const productCount =
                  productCounts.get(category.id) ?? 0;

                const renameAction =
                  renameCategory.bind(null, category.id);

                const deleteAction =
                  deleteCategory.bind(null, category.id);

                return (
                  <div
                    key={category.id}
                    className="p-4 border-b last:border-b-0"
                    style={{
                      borderColor: "var(--sand)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <p className="font-medium text-sm">
                          {category.name}
                        </p>

                        <p className="text-xs text-gray-500 mt-0.5">
                          {productCount === 1
                            ? "1 product"
                            : `${productCount} products`}
                        </p>
                      </div>

                      <form action={deleteAction}>
                        <button
                          type="submit"
                          disabled={productCount > 0}
                          className="rounded-lg border px-3 py-2 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{
                            borderColor: "var(--sand)",
                            color: "var(--clay)",
                          }}
                          title={
                            productCount > 0
                              ? "Products are using this category"
                              : "Delete category"
                          }
                        >
                          Delete
                        </button>
                      </form>
                    </div>

                    <form
                      action={renameAction}
                      className="flex gap-2"
                    >
                      <input
                        name="name"
                        required
                        minLength={2}
                        maxLength={60}
                        defaultValue={category.name}
                        className="flex-1 min-w-0 rounded-lg border px-3 py-2 text-sm outline-none"
                        style={{
                          borderColor: "var(--sand)",
                        }}
                      />

                      <button
                        type="submit"
                        className="rounded-lg border px-4 py-2 text-xs font-medium"
                        style={{
                          borderColor: "var(--sand)",
                          color: "var(--indigo)",
                        }}
                      >
                        Rename
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
