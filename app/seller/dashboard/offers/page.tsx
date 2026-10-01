import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SellerNav } from "@/components/SellerNav";
import { requireOfferSeller } from "@/lib/seller-offer-access";
import { OfferForm } from "./OfferForm";
import { removeOffer } from "./actions";
import { requestTime } from "@/lib/server-time";

export default async function SellerOffersPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const { product: initialProduct } = await searchParams;
  const { supabase, user } = await requireOfferSeller();
  const [{ data: products, error: productsError }, { data: offers, error: offersError }] = await Promise.all([
    supabase.from("products").select("id, title, price").eq("seller_id", user.id).eq("status", "active").gt("stock_quantity", 0).gt("price", 0).is("seller_deleted_at", null).order("title"),
    supabase.from("product_offers").select("product_id, kind, percent_off, voucher_code, expires_at, products(title)").eq("seller_id", user.id).order("expires_at", { ascending: false }),
  ]);
  if (productsError || offersError) console.error("Could not load seller offers:", productsError ?? offersError);
  const now = await requestTime();
  return <><SiteHeader /><main className="mx-auto max-w-3xl px-4 py-6 pb-24 sm:pb-8">
    <h1 className="font-display text-2xl mb-4">Discounts & vouchers</h1><SellerNav active="offers" />
    {productsError || offersError ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">Couldn’t load your offers. Please refresh and try again.</p> : <>
      {products?.length ? <OfferForm products={products} initialProduct={initialProduct} /> : <div className="rounded-xl border bg-white p-5"><p>Publish a product to create an offer.</p><Link href="/seller/dashboard/new" className="primary-button mt-3">Add a product</Link></div>}
      <h2 className="font-display text-lg mt-7 mb-3">Your offers</h2>
      <div className="space-y-3">{offers?.length ? offers.map((offer) => <div key={offer.product_id} className="rounded-xl border bg-white p-4 flex items-start gap-3">
        <div className="min-w-0 flex-1"><Link href={`/seller/dashboard/products/${offer.product_id}`} className="font-semibold break-words">{(offer.products as unknown as { title: string } | null)?.title ?? "Product"}</Link>
          <p className="text-sm mt-1">{offer.percent_off}% off · {offer.kind === "voucher" ? `Code: ${offer.voucher_code}` : "Automatic"}</p>
          <p className="text-xs text-gray-500 mt-1">{Date.parse(offer.expires_at) <= now ? "Expired" : "Ends"} · {new Date(offer.expires_at).toLocaleDateString("en-GB", { timeZone: "UTC" })} (UTC)</p>
        </div>
        <form action={removeOffer}><input type="hidden" name="product_id" value={offer.product_id} /><button className="text-sm text-red-700 py-2 px-1">End offer</button></form>
      </div>) : <p className="text-sm text-gray-500">No offers yet.</p>}</div>
    </>}
  </main></>;
}
