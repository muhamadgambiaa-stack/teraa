import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";

import { createSupportThread } from "../actions";

export default async function NewSupportPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/account/support/new");
  }

  return (
    <>
      <SiteHeader />

      <main className="max-w-lg mx-auto px-4 py-6 pb-24 sm:pb-8">
        <Link
          href="/account/support"
          className="text-xs text-gray-500 hover:underline"
        >
          ← Back to support
        </Link>

        <h1
          className="font-display text-2xl mt-5"
          style={{
            color: "var(--ink)",
          }}
        >
          Contact Support
        </h1>

        <p className="text-sm text-gray-500 mt-1 mb-6">
          Tell us what you need help with.
        </p>

        <form action={createSupportThread} className="space-y-5">
          <div>
            <label
              htmlFor="category"
              className="text-sm font-medium block mb-1.5"
            >
              What do you need help with?
            </label>

            <select
              id="category"
              name="category"
              required
              defaultValue=""
              className="w-full rounded-xl border bg-white px-3 py-3 text-sm outline-none"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              <option value="" disabled>
                Choose a topic
              </option>

              <option value="order">Order</option>

              <option value="delivery">Delivery</option>

              <option value="seller_account">Seller account</option>

              <option value="account">Account</option>

              <option value="payment">Payment</option>

              <option value="report">Report a problem</option>

              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="subject"
              className="text-sm font-medium block mb-1.5"
            >
              Subject
            </label>

            <input
              id="subject"
              name="subject"
              type="text"
              required
              minLength={3}
              maxLength={150}
              placeholder="Briefly describe the problem"
              className="w-full rounded-xl border bg-white px-3 py-3 text-sm outline-none"
              style={{
                borderColor: "var(--sand)",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="message"
              className="text-sm font-medium block mb-1.5"
            >
              Message
            </label>

            <textarea
              id="message"
              name="message"
              required
              rows={6}
              maxLength={4000}
              placeholder="Explain what happened and what you need help with."
              className="w-full rounded-xl border bg-white px-3 py-3 text-sm outline-none resize-none"
              style={{
                borderColor: "var(--sand)",
              }}
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-full py-3 text-sm font-semibold text-white"
            style={{
              background: "var(--indigo)",
            }}
          >
            Start support conversation
          </button>
        </form>
      </main>
    </>
  );
}
