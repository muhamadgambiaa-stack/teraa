# Teraa

Teraa is a marketplace platform built for The Gambia, designed to connect buyers and sellers in one simple, local marketplace.

Users can create accounts, browse and search products, save favorites, place orders, manage purchases, and review products after completed transactions.

Verified sellers can create and manage listings, receive and process orders, configure payment methods, manage their public shop profile, and request reviews of listings removed by Teraa moderation.

Administrators can manage marketplace activity, verify sellers, moderate listings, handle reports and appeals, and restrict problematic accounts.

---

## Tech Stack

Teraa is built with:

- Next.js
- TypeScript
- Tailwind CSS
- Supabase
- PostgreSQL
- Supabase Authentication
- Supabase Storage
- Row Level Security (RLS)
- Vercel
- GitHub

---

# Core Features

## Buyer Accounts

Buyers can:

- Create an account
- Verify their email
- Log in securely
- Browse marketplace listings
- Search products
- Filter products by category
- Filter by city
- Filter by condition
- Filter by price
- Sort search results
- Save products to favorites
- View product details
- Place orders
- Choose available seller payment methods
- Use cash on delivery when available
- View their order history
- Cancel eligible orders
- Confirm that an order has been received
- Review products after completed purchases
- Receive marketplace notifications
- View public seller profiles
- Report problematic listings

Private buyer information such as purchase history, payment information and contact information is not displayed publicly.

---

## Seller Accounts

Users can apply to become sellers.

Seller accounts must pass Teraa verification before they can publish live marketplace listings.

Verified sellers can:

- Create product listings
- Upload product photos
- Select product categories
- Set product condition
- Set prices
- Set stock quantities
- Choose listing locations
- Edit existing listings
- Hide listings
- Reactivate seller-hidden listings
- Restock out-of-stock products
- Receive buyer orders
- View individual order details
- Confirm orders
- Mark orders as shipped
- Mark orders as delivered
- Cancel eligible orders
- View completed and historical orders
- Configure supported payment methods
- Set business information
- Add a shop description
- Maintain a public seller profile

Seller listings can have the following states:

- `active`
- `out_of_stock`
- `hidden`
- `admin_hidden`

Listings removed by Teraa administrators cannot be restored directly by sellers.

---

# Seller Verification

Seller verification is required before selling.

Seller verification documents are stored separately from public marketplace content.

The verification system supports:

- Pending verification
- Approved verification
- Rejected verification

Administrators can review seller verification requests before allowing sellers to publish products.

Seller identity documents must never be exposed through public marketplace pages.

---

# Product Listings

Products support:

- Title
- Description
- Category
- Price
- Condition
- Stock quantity
- City/location
- Multiple product photos
- Cover photo
- Seller information
- Listing status

Only active listings should appear publicly in marketplace feeds and search results.

Out-of-stock, seller-hidden and administrator-hidden listings are excluded from normal marketplace discovery.

---

# Categories

Teraa uses database-backed product categories.

Sellers select a category while creating or editing a listing.

Buyers can browse or filter marketplace products using these categories.

Categories are managed through Supabase and can be expanded as the marketplace grows.

---

# Search & Discovery

The marketplace includes product discovery tools for:

- Text search
- Categories
- Location/city
- Product condition
- Minimum price
- Maximum price
- Price sorting
- Newest listings

The homepage focuses on marketplace discovery while the full search page provides broader filtering.

---

# Favorites

Authenticated users can save products to their favorites.

Favorites are associated with both:

- the buyer account
- the product

Users can add and remove saved products without affecting the original listing.

---

# Orders

Teraa includes a complete buyer/seller order workflow.

Typical order progression:

```text
placed
   ↓
confirmed
   ↓
shipped
   ↓
delivered
   ↓
completed
```

Orders can also become:

```text
cancelled
```

Sellers manage incoming orders from:

```text
/seller/dashboard/orders
```

Individual seller order details are available through:

```text
/seller/dashboard/orders/[id]
```

Buyers can view their own orders separately.

Order ownership and access are protected so sellers cannot manage another seller's orders and buyers cannot manage another buyer's purchases.

---

# Product Reviews

Reviews are connected to completed purchases.

A buyer can review a product only after the corresponding order has been completed.

The review system verifies:

- The buyer owns the order
- The order is completed
- The reviewed product belongs to that order
- The buyer has not already reviewed the same purchased product/order combination

Reviews are displayed with the relevant product rather than being treated only as a general seller review.

This provides buyers with more useful information about the specific item they are considering.

---

# Seller Public Profiles

Teraa provides public marketplace profiles.

Seller profiles can display:

- Business/shop name
- Seller name where appropriate
- Profile photo
- Shop banner
- City
- Shop description
- Verification status
- Active listings
- Completed sales
- Member-since information

Completed sales are calculated using actual completed marketplace orders.

Private seller information is not intended to be exposed through the public profile.

---

# Payments

Teraa supports seller-configured payment methods.

Current marketplace flows support methods such as:

- Mobile money
- Bank transfer
- Cash on delivery

For direct digital payments, buyers receive the seller's payment information during the order process.

Teraa currently does not operate an escrow system.

Buyers should verify transactions carefully and inspect products where appropriate before completing face-to-face transactions.

---

# Notifications

Teraa includes an in-app notification system.

Notifications can be used for events involving:

- Orders
- Payments
- Messages
- Seller verification
- Moderation
- Appeals
- Account activity

Users can mark individual notifications as read or mark all notifications as read.

---

# Marketplace Moderation

Teraa includes administrative moderation tools.

Administrators can moderate marketplace activity and problematic listings.

A listing removed by an administrator receives:

```text
admin_hidden
```

A seller cannot bypass this state simply by editing or restocking the product.

---

# Listing Appeals

Sellers can request another review when Teraa removes a listing.

The appeal system allows:

1. An administrator to remove a listing
2. A moderation reason to be recorded
3. The seller to correct the listing
4. The seller to submit an appeal
5. An administrator to review the appeal
6. The administrator to approve or reject the request

Only one pending appeal should exist for the same listing at a time.

Possible appeal states include:

```text
pending
approved
rejected
```

Banned accounts cannot submit listing appeals.

---

# Account Moderation

Teraa supports account-level moderation.

Account states can be used to control whether a user or seller can continue operating on the marketplace.

Examples include:

- Active
- Restricted
- Suspended
- Banned

Restricted or suspended functionality should be enforced on the server/database side rather than relying only on hidden interface buttons.

Banned accounts should not be able to continue normal marketplace operations.

---

# Admin System

Teraa includes an administrator dashboard.

Administrative functionality includes areas such as:

- Marketplace overview
- Seller verification
- User management
- Seller management
- Listing moderation
- Reports
- Listing appeals
- Account restrictions
- Marketplace monitoring

The system is designed to support multiple administrators.

Administrator access is determined by account roles rather than being hardcoded to one specific user.

---

# Security

Teraa uses Supabase Row Level Security and server-side authorization checks to protect marketplace data.

Important protections include:

- Buyers can access only authorized buyer data
- Sellers can manage only their own listings
- Sellers can manage only orders belonging to their seller account
- Unverified sellers cannot publish live marketplace listings
- Administrator-hidden products cannot be restored by sellers
- Reviews require valid completed purchases
- Seller verification documents are private
- Public profiles should expose only intentionally public information
- Administrative actions require administrator authorization

Frontend restrictions alone should never be considered sufficient security.

---

# Supabase Storage

Teraa uses Supabase Storage for marketplace files.

Storage includes areas for content such as:

- Product photos
- Seller verification documents
- Profile photos
- Shop banners

Public marketplace media and private identity documents should use appropriately separated access policies.

---

# Authentication

Teraa currently uses Supabase authentication with email verification.

Phone numbers may still be collected where needed for marketplace contact, payments or delivery, but they are not the primary authentication mechanism.

Supabase's default email delivery is suitable for early development and testing.

For larger production usage, configure a dedicated SMTP/email provider.

---

# Environment Variables

Create:

```text
.env.local
```

Never commit this file to GitHub.

Required public Supabase configuration includes:

```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

Never place private service-role keys or other production secrets inside the README or commit them to the repository.

---

# Local Development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

# Production Build

Before deploying changes, always run:

```bash
npm run build
```

Fix all build errors before pushing to production.

If Windows/OneDrive locks generated Next.js build files and produces an `EPERM` error involving `.next`, stop running development/build processes and remove the generated `.next` directory before rebuilding.

`.next` contains generated Next.js build output and will be recreated automatically.

---

# Deployment

Teraa is deployed using Vercel.

Typical deployment workflow:

```bash
git add .
git commit -m "Describe the change"
git push
```

Vercel automatically creates a new deployment from the connected GitHub repository.

Production environment variables must also be configured in Vercel.

---

# Database

Teraa uses PostgreSQL through Supabase.

The database contains marketplace data including:

- Users
- Sellers
- Categories
- Products
- Product photos
- Favorites
- Orders
- Order items
- Reviews
- Notifications
- Seller payment methods
- Reports
- Listing appeals
- Moderation information

Database migrations should be tracked carefully as the production database evolves.

Do not repeatedly run an old full schema against a live production database unless it was specifically designed to be safely rerun.

Use migrations for production database changes.

---

# Making an Administrator

Create the user normally first.

Then assign the appropriate administrator role through a controlled database operation.

For example, depending on the current users schema:

```sql
update public.users
set role = 'admin'
where id = 'USER_UUID';
```

Using the user's UUID is preferable to relying on a mutable phone number.

Multiple users can be assigned the administrator role if multiple administrators are required.

Administrator privileges should always be protected by the database/server authorization system.

---

# Pre-Deployment Checklist

Before pushing major changes:

- Run `npm run build`
- Confirm authentication works
- Confirm homepage listings load
- Confirm search works
- Test favorites
- Test buyer checkout
- Test buyer orders
- Test seller orders
- Test seller order details
- Test listing creation
- Test listing editing
- Test categories
- Test seller payment settings
- Test completed-order flow
- Test product reviews
- Test notifications
- Test seller public profiles
- Test seller verification
- Test reports
- Test listing moderation
- Test appeals
- Test account restrictions
- Test administrator authorization

---

# Current Development Priorities

Teraa's core marketplace infrastructure is now substantially beyond the original starter version.

Before adding major new systems, priority should be given to stabilizing and testing the existing marketplace.

Important remaining areas include:

1. **Favorites reliability**
   - Ensure `/favorites` works correctly in production and saved products load consistently.

2. **End-to-end order testing**
   - Test the complete buyer → seller → delivery → completion → review lifecycle.

3. **Payment and commission strategy**
   - Determine how Teraa will eventually monetize completed transactions without introducing unnecessary friction during early marketplace growth.

4. **In-app messaging**
   - Introduce buyer/seller messaging when the marketplace is ready for it.

5. **Delivery**
   - A future delivery-driver system could allow approved drivers to accept or receive marketplace delivery jobs.

6. **Production security audit**
   - Review RLS policies, storage access, admin authorization and server actions before a larger public launch.

7. **Marketplace launch testing**
   - Test with a small group of real buyers and sellers before broad public promotion.

---

# Project Status

Teraa is under active development and is not yet considered a finished production marketplace.

The current focus is building a stable, secure marketplace foundation for buyers and sellers in The Gambia before scaling users, payments, delivery and monetization.
