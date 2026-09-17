import Link from "next/link";

export type MarketplaceRole = "guest" | "buyer" | "seller" | "admin";

const roleActions: Record<
  MarketplaceRole,
  { eyebrow: string; title: string; body: string; label: string; href: string }
> = {
  guest: {
    eyebrow: "Welcome to Teraa",
    title: "Ready to start?",
    body: "Create a free account to order, message sellers and save products.",
    label: "Join Teraa free",
    href: "/signup",
  },
  buyer: {
    eyebrow: "Sell on Teraa",
    title: "Have something to sell?",
    body: "Open your shop and reach buyers across The Gambia.",
    label: "Start selling",
    href: "/seller/register",
  },
  seller: {
    eyebrow: "Your shop",
    title: "Keep your listings fresh",
    body: "Add products, manage orders and keep buyers updated.",
    label: "Manage your shop",
    href: "/seller/dashboard",
  },
  admin: {
    eyebrow: "Administration",
    title: "Marketplace overview",
    body: "Review sellers, listings, orders and support requests.",
    label: "Open admin dashboard",
    href: "/admin",
  },
};

export function DesktopHomeAside({ role }: { role: MarketplaceRole }) {
  const action = roleActions[role];

  return (
    <aside className="sticky top-[84px] hidden h-fit space-y-4 xl:block">
      <section
        className="overflow-hidden rounded-2xl p-4 text-white"
        style={{
          background:
            "linear-gradient(145deg, var(--indigo) 0%, #17324d 68%, #244f71 100%)",
        }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/70">
          {action.eyebrow}
        </p>
        <h2 className="mt-2 font-display text-lg font-semibold">{action.title}</h2>
        <p className="mt-2 text-xs leading-5 text-white/75">{action.body}</p>
        <Link
          href={action.href}
          className="mt-3 flex w-full items-center justify-center rounded-full px-4 py-2 text-xs font-bold text-white transition hover:brightness-105"
          style={{ background: "var(--clay)" }}
        >
          {action.label}
        </Link>
      </section>

      <section
        className="rounded-2xl border bg-white p-4"
        style={{ borderColor: "var(--sand)" }}
      >
        <p className="text-sm font-semibold">Shop with confidence</p>
        <ul className="mt-3 space-y-3 text-xs leading-5 text-gray-500">
          <li className="flex gap-2">
            <CheckIcon />
            Check for the verified seller badge.
          </li>
          <li className="flex gap-2">
            <CheckIcon />
            Confirm the item before making payment.
          </li>
          <li className="flex gap-2">
            <CheckIcon />
            Keep your order and messages inside Teraa.
          </li>
        </ul>
        <Link
          href="/safety"
          className="mt-3 inline-flex text-xs font-semibold hover:underline"
          style={{ color: "var(--indigo)" }}
        >
          Read safety tips
        </Link>
      </section>

      <Link
        href={role === "guest" ? "/login" : "/account/support"}
        className="flex items-center justify-between rounded-2xl border bg-white p-4 transition hover:shadow-sm"
        style={{ borderColor: "var(--sand)" }}
      >
        <span>
          <span className="block text-sm font-semibold">Need help?</span>
          <span className="mt-0.5 block text-xs text-gray-500">Contact Teraa Support</span>
        </span>
        <span aria-hidden="true" style={{ color: "var(--indigo)" }}>
          →
        </span>
      </Link>
    </aside>
  );
}

function CheckIcon() {
  return (
    <span
      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
      style={{ background: "var(--leaf)" }}
      aria-hidden="true"
    >
      ✓
    </span>
  );
}
