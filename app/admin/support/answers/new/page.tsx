import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";

import { createSupportAnswer } from "../actions";

export default async function NewSupportAnswerPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: isAdmin } = await supabase.rpc("current_user_is_admin");

  if (!isAdmin) {
    redirect("/");
  }

  return (
    <>
      <SiteHeader />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 sm:pb-8">
        <Link
          href="/admin/support/answers"
          className="text-xs text-gray-500 hover:underline"
        >
          ← Support answers
        </Link>

        <h1
          className="font-display text-2xl mt-5"
          style={{
            color: "var(--ink)",
          }}
        >
          Add Support Answer
        </h1>

        <p className="text-sm text-gray-500 mt-1 mb-6">
          Teach Teraa Assistant how to answer another common question.
        </p>

        <form action={createSupportAnswer} className="space-y-5">
          <AnswerFields />

          <button
            type="submit"
            className="w-full rounded-full py-3 text-sm font-semibold text-white"
            style={{
              background: "var(--indigo)",
            }}
          >
            Add support answer
          </button>
        </form>
      </main>
    </>
  );
}

function AnswerFields() {
  return (
    <>
      <div>
        <label className="block text-sm font-medium mb-1.5">Slug</label>

        <input
          name="slug"
          required
          minLength={3}
          maxLength={100}
          placeholder="example: delivery-late"
          className="w-full rounded-xl border px-3 py-3 text-sm outline-none"
          style={{
            borderColor: "var(--sand)",
          }}
        />

        <p className="text-xs text-gray-500 mt-1">
          Lowercase letters, numbers and hyphens only.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Category</label>

        <select
          name="category"
          required
          defaultValue="all"
          className="w-full rounded-xl border bg-white px-3 py-3 text-sm"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          <option value="all">All</option>

          <option value="order">Order</option>

          <option value="delivery">Delivery</option>

          <option value="seller_account">Seller account</option>

          <option value="account">Account</option>

          <option value="payment">Payment</option>

          <option value="report">Report</option>

          <option value="other">Other</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">
          Matching phrases
        </label>

        <textarea
          name="keywords"
          required
          rows={8}
          placeholder={`can i pay with wave
pay with wave
wave payment
can i use wave`}
          className="w-full rounded-xl border px-3 py-3 text-sm outline-none resize-y"
          style={{
            borderColor: "var(--sand)",
          }}
        />

        <p className="text-xs text-gray-500 mt-1">
          Put one phrase on each line. Add different ways users might ask the
          same question.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">
          Automatic answer
        </label>

        <textarea
          name="answer"
          required
          maxLength={4000}
          rows={7}
          placeholder="Write the answer Teraa Assistant should send."
          className="w-full rounded-xl border px-3 py-3 text-sm outline-none resize-y"
          style={{
            borderColor: "var(--sand)",
          }}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Priority</label>

        <input
          name="priority"
          type="number"
          min={0}
          max={1000}
          defaultValue={100}
          required
          className="w-full rounded-xl border px-3 py-3 text-sm outline-none"
          style={{
            borderColor: "var(--sand)",
          }}
        />

        <p className="text-xs text-gray-500 mt-1">
          Higher priority answers win when more than one answer matches.
        </p>
      </div>

      <label
        className="flex items-start gap-3 rounded-xl border p-4 cursor-pointer"
        style={{
          borderColor: "var(--sand)",
        }}
      >
        <input name="requiresHuman" type="checkbox" className="mt-1" />

        <div>
          <p className="text-sm font-medium">Escalate to human support</p>

          <p className="text-xs text-gray-500 mt-1">
            The assistant will send this answer and then notify a human support
            agent.
          </p>
        </div>
      </label>
    </>
  );
}
