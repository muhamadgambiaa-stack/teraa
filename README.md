# Gambia Marketplace — v1 starter

## What's in this package

- `supabase/schema.sql` — full database schema with Row Level Security policies.
  Run this once in your Supabase project.
- `app/` — the Next.js 14 (App Router) + Tailwind + TypeScript project, wired
  up to Supabase for auth (phone + OTP) and data.

## Setup, step by step

### 1. Create your Supabase project
- supabase.com → New Project → region **Europe West (London)**
- Save your database password somewhere safe

### 2. Run the schema
- In your Supabase project, open **SQL Editor**
- Paste the entire contents of `supabase/schema.sql` and run it
- This creates every table, enum, index, RLS policy, storage buckets
  (product photos + seller ID documents), the seller-rating trigger, and
  seeds starter categories
- **If you already ran an older version of `schema.sql`**, run whichever
  migrations you're missing from `supabase/migrations/` in order — each is
  safe to run on its own:
  - `002_storage_buckets.sql` — product photo & seller document storage
  - `003_rating_trigger.sql` — auto-updates a seller's star rating when
    reviews come in
  - `004_require_seller_approval.sql` — closes a security gap where an
    unverified seller could publish a live listing (found during
    pre-launch audit, see below)

### 3. Email auth works out of the box, no extra setup needed
Supabase sends OTP verification codes over email by default at no cost,
so signup and login work immediately after step 2. Phone number is still
collected during signup (used for Wave payments and delivery contact) but
it's no longer the authentication method.

If you switch to phone-based auth later (e.g. once you're ready to pay for
SMS delivery via Twilio, MessageBird, or another provider), you'll need to
enable Phone under Supabase → Authentication → Providers, connect an SMS
provider there, and swap `email` back to `phone` in
`app/(auth)/login/page.tsx` and `app/(auth)/signup/page.tsx`.

One thing worth knowing: Supabase's default built-in email sending has a
fairly low rate limit, fine for early testing, but if you hit delivery
issues once you have real signups, connect a custom SMTP provider under
Supabase → Authentication → Email settings. Services like Resend or Brevo
have generous free tiers that cover early-stage volume.

### 4. Connect the app to Supabase
- In `app/`, copy `.env.local.example` to `.env.local`
- Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from
  Supabase → Project Settings → API

### 5. Run it locally
```bash
cd app
npm install
npm run dev
```
Open http://localhost:3000, you should see the homepage (empty until you add
products), and `/signup` and `/login` should work once phone auth is live.

If you're using VS Code, open this folder directly (`File → Open Folder`),
recommended extensions (Prettier, ESLint, Tailwind CSS IntelliSense) will
be suggested automatically the first time you open it.

### 6. Deploy
Push this to a GitHub repo, then import it into Vercel. Add the same two env
vars in Vercel's project settings. Vercel will auto-deploy on every push.

### 7. Make yourself an admin
Sign up on the live site as a normal user first (buyer or seller, doesn't
matter — the `users` row just needs to exist), then in Supabase SQL Editor run:
```sql
update public.users set role = 'admin' where phone_number = '+220XXXXXXX';
```
Replace with your actual phone number. You can now visit `/admin` to approve
sellers and review reports.


- Homepage with product grid, category chips, verified-seller badge, trust banner
- Search & filters: text search, location, condition, price range, sort — `/search`
- Product detail page with honest payment/trust disclosures
- Signup flow: name, phone, city, buyer/seller choice → OTP → profile created
- Login flow: phone → OTP
- Seller dashboard: verification gate (pending/rejected/approved states),
  listing management view
- Seller ID verification upload (`/seller/dashboard/verify`)
- New listing form with multi-photo upload, category, condition, price,
  stock, location (`/seller/dashboard/new`)
- Full RLS security model: buyers only see their own cart/orders, sellers
  only see their own commission/payout data, reviews only postable after a
  completed order, admins have override access via `is_admin()`
- Storage: public product-photos bucket, private seller-documents bucket
  (only the seller and admins can read their own ID uploads)
- Admin dashboard (`/admin`): overview counts, seller verification queue
  with ID document preview + approve/reject, reports queue
- Report submission — the "Report this listing" link on product pages now
  opens a real form that writes into the `reports` table, feeding the admin
  reports queue directly
- Checkout flow (`/products/[id]/checkout`): quantity, payment method
  (Wave or cash on delivery), delivery city/notes → creates a real `order`,
  `order_items`, and `commissions` record. Stock is decremented on order.
- Order confirmation page (`/orders/[id]`): shows the seller's Wave number
  for Wave orders, or delivery/COD instructions
- Seller dashboard now has tabs: **Listings**, **Orders**, **Settings**
- Seller order management (`/seller/dashboard/orders`): sellers see incoming
  orders with buyer contact info and delivery details, and move each order
  through placed → confirmed → shipped → delivered with one click
- Seller settings (`/seller/dashboard/settings`): sellers can now set their
  own Wave number, business name, and shop description — this was
  previously only settable directly in Supabase
- Order completion + reviews: once a buyer marks "I've received this
  order," the order moves to `completed` and a review form appears. A
  database trigger keeps each seller's star rating in sync automatically.

## What's next (in rough order)

1. **COD commission collection** — as discussed early on, COD orders don't
   have a way to collect your commission automatically. The `commissions`
   table already tracks what's owed per order; you'll want either a manual
   invoicing process or a small deposit-on-COD mechanism once volume grows.
2. **In-app messaging** — buyers currently have no way to contact a seller
   before or after checkout except phone/Wave, which is fine for v1 but
   worth revisiting (the `conversations`/`messages` tables already exist
   in the schema for this, unused so far).
3. **Seller payout tracking UI** — the `commissions` table tracks what each
   seller is owed, but there's no dashboard view of it yet for either you
   or the seller.
4. **Cancel-order UI for buyers** — sellers can cancel from their dashboard,
   but buyers can't cancel their own order yet.

Each of these is a self-contained chunk — good candidates to tackle one at a
time rather than all at once.
