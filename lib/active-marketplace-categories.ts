import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ActiveMarketplaceCategory = {
  id: string;
  name: string;
};

export async function getActiveMarketplaceCategories(): Promise<
  ActiveMarketplaceCategory[]
> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("categories")
      .select(
        `
        id,
        name,
        products!inner(id)
        `,
      )
      .is("parent_category_id", null)
      .eq("products.status", "active")
      .order("name", { ascending: true })
      .limit(1, { referencedTable: "products" });

    if (error) {
      console.error("Could not load active marketplace categories:", error);
      return [];
    }

    return (data ?? []).map((category) => ({
      id: category.id,
      name: category.name,
    }));
  } catch (error) {
    console.error("Could not load active marketplace categories:", error);
    return [];
  }
}
