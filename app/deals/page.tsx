import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { createClient } from "@/lib/supabase/server";
import { offerPrice, type ProductOffer } from "@/lib/offer-pricing";

export const metadata = { title: "Deals & vouchers | Teraa", alternates: { canonical: "/deals" } };
const PAGE_SIZE = 30;

type DealRow = ProductOffer & {
  products: { id: string; title: string; price: number; condition: ProductCardData["condition"]; location_city: string; seller_id: string; product_photos: { photo_url: string; is_cover: boolean; sort_order: number }[] };
};

export default async function DealsPage({ searchParams }: { searchParams: Promise<{ type?: string; page?: string }> }) {
  const params = await searchParams;
  const type = params.type === "discount" || params.type === "voucher" ? params.type : "all";
  const requestedPage = Number(params.page ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 10000 ? requestedPage : 1;
  const supabase = await createClient();
  let query = supabase.from("product_offers").select("product_id, kind, percent_off, voucher_code, expires_at, products!inner(id, title, price, condition, location_city, seller_id, product_photos(photo_url, is_cover, sort_order))", { count: "exact" })
    .gt("expires_at", new Date().toISOString()).eq("products.status", "active").gt("products.stock_quantity", 0).is("products.seller_deleted_at", null)
    .order("percent_off", { ascending: false }).order("product_id").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (type !== "all") query = query.eq("kind", type);
  const { data, count, error } = await query;
  if (error) console.error("Deals lookup failed:", error);
  const rows = (data ?? []) as unknown as DealRow[];
  const sellerIds = [...new Set(rows.map((row) => row.products.seller_id))];
  const profiles = await Promise.all(sellerIds.map(async (id) => {
    const { data } = await supabase.rpc("get_public_profile", { p_user_id: id });
    return [id, Array.isArray(data) ? data[0] : data] as const;
  }));
  const sellerNames = new Map(profiles);
  const products: ProductCardData[] = rows.map((row) => {
    const product = row.products;
    const photos = [...(product.product_photos ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    const profile = sellerNames.get(product.seller_id);
    return { id: product.id, title: product.title, originalPrice: Number(product.price),
      price: row.kind === "discount" ? offerPrice(Number(product.price), row.percent_off) : Number(product.price),
      condition: product.condition, location_city: product.location_city,
      coverPhoto: photos.find((photo) => photo.is_cover)?.photo_url ?? photos[0]?.photo_url ?? null,
      sellerName: profile?.business_name ?? profile?.full_name ?? null,
      sellerVerified: profile?.verification_status === "approved",
      offer: { product_id: row.product_id, kind: row.kind, percent_off: row.percent_off, voucher_code: row.voucher_code, expires_at: row.expires_at },
    };
  });
  function pageHref(next: number) { return `/deals?type=${type}&page=${next}`; }
  return <><SiteHeader /><main className="mx-auto max-w-[1460px] px-4 py-6 sm:px-6 pb-24 sm:pb-8">
    <h1 className="font-display text-2xl sm:text-3xl">Deals & vouchers</h1>
    <p className="mt-2 text-sm text-gray-500">Save on local finds. Seller discounts and voucher offers.</p>
    <nav aria-label="Offer type" className="flex gap-2 my-5">
      {(["all", "discount", "voucher"] as const).map((tab) => <Link key={tab} href={`/deals?type=${tab}`} aria-current={type === tab ? "page" : undefined} className={type === tab ? "primary-button" : "secondary-button"}>{tab === "all" ? "All offers" : tab === "discount" ? "Discounts" : "Vouchers"}</Link>)}
    </nav>
    {error ? <div role="alert" className="rounded-xl border bg-white p-6"><p>We couldn’t load Deals.</p><Link href={pageHref(page)} className="mt-3 inline-block underline">Try again</Link></div> : products.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="rounded-2xl border bg-white p-8 text-center"><h2 className="font-display text-xl">No live offers here yet</h2><p className="text-sm text-gray-500 mt-2">Check back soon for seller discounts and vouchers.</p><Link href="/search" className="primary-button mt-4">Browse all products</Link>{page > 1 && <Link href="/deals" className="block mt-4 text-sm underline">Back to the first page</Link>}</div>}
    {!error && <nav aria-label="Deals pages" className="flex justify-center gap-3 mt-6">{page > 1 && <Link href={pageHref(page - 1)} className="secondary-button">Previous</Link>}{page * PAGE_SIZE < (count ?? 0) && <Link href={pageHref(page + 1)} className="secondary-button">Next</Link>}</nav>}
  </main></>;
}
