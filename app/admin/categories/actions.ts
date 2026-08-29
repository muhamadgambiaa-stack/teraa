"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/require-admin";

function refreshCategoryPages() {
  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath("/seller/dashboard/new");
  revalidatePath("/admin");
  revalidatePath("/admin/categories");
}

export async function createCategory(formData: FormData) {
  const { supabase } = await requireAdmin();

  const name = String(formData.get("name") ?? "")
    .trim()
    .replace(/\s+/g, " ");

  if (name.length < 2 || name.length > 60) {
    throw new Error("Category name must be between 2 and 60 characters.");
  }

  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .is("parent_category_id", null)
    .ilike("name", name)
    .limit(1)
    .maybeSingle();

  if (existing) {
    throw new Error("A category with this name already exists.");
  }

  const { error } = await supabase.from("categories").insert({
    name,
    parent_category_id: null,
  });

  if (error) {
    throw new Error(error.message || "Could not create category.");
  }

  refreshCategoryPages();
}

export async function renameCategory(
  categoryId: string,
  formData: FormData,
) {
  const { supabase } = await requireAdmin();

  const name = String(formData.get("name") ?? "")
    .trim()
    .replace(/\s+/g, " ");

  if (name.length < 2 || name.length > 60) {
    throw new Error("Category name must be between 2 and 60 characters.");
  }

  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .is("parent_category_id", null)
    .ilike("name", name)
    .neq("id", categoryId)
    .limit(1)
    .maybeSingle();

  if (existing) {
    throw new Error("Another category already uses this name.");
  }

  const { error } = await supabase
    .from("categories")
    .update({
      name,
    })
    .eq("id", categoryId)
    .is("parent_category_id", null);

  if (error) {
    throw new Error(error.message || "Could not rename category.");
  }

  refreshCategoryPages();
}

export async function deleteCategory(categoryId: string) {
  const { supabase } = await requireAdmin();

  const { count: productCount } = await supabase
    .from("products")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("category_id", categoryId);

  if ((productCount ?? 0) > 0) {
    throw new Error(
      "This category cannot be deleted because products are using it.",
    );
  }

  const { count: childCount } = await supabase
    .from("categories")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("parent_category_id", categoryId);

  if ((childCount ?? 0) > 0) {
    throw new Error(
      "This category cannot be deleted because it has subcategories.",
    );
  }

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", categoryId)
    .is("parent_category_id", null);

  if (error) {
    throw new Error(error.message || "Could not delete category.");
  }

  refreshCategoryPages();
}
