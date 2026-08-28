import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";

import { setSupportAnswerActive, updateSupportAnswer } from "../actions";

export default async function EditSupportAnswerPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;

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

  const { data: answer, error } = await supabase
    .from("support_answers")
    .select(
      `
      id,
      slug,
      category,
      keywords,
      answer,
      requires_human,
      priority,
      active,
      updated_at
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !answer) {
    notFound();
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

        <div className="flex items-start justify-between gap-4 mt-5 mb-6">
          <div>
            <h1
              className="font-display text-2xl"
              style={{
                color: "var(--ink)",
              }}
            >
              Edit Support Answer
            </h1>

            <p className="text-sm text-gray-500 mt-1">
              Update how Teraa Assistant handles this question.
            </p>
          </div>

          <span
            className="rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{
              background: answer.active ? "#e3f0e8" : "#eeeeee",

              color: answer.active ? "var(--leaf)" : "#666",
            }}
          >
            {answer.active ? "Active" : "Disabled"}
          </span>
        </div>

        <form
          action={updateSupportAnswer.bind(null, answer.id)}
          className="space-y-5"
        >
          <div>
            <label className="block text-sm font-medium mb-1.5">Slug</label>

            <input
              name="slug"
              required
              defaultValue={answer.slug}
              className="w-full rounded-xl border px-3 py-3 text-sm"
              style={{
                borderColor: "var(--sand)",
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Category</label>

            <select
              name="category"
              required
              defaultValue={answer.category}
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
              rows={10}
              defaultValue={(answer.keywords ?? []).join("\n")}
              className="w-full rounded-xl border px-3 py-3 text-sm resize-y"
              style={{
                borderColor: "var(--sand)",
              }}
            />

            <p className="text-xs text-gray-500 mt-1">One phrase per line.</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Automatic answer
            </label>

            <textarea
              name="answer"
              required
              rows={8}
              maxLength={4000}
              defaultValue={answer.answer}
              className="w-full rounded-xl border px-3 py-3 text-sm resize-y"
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
              required
              min={0}
              max={1000}
              defaultValue={answer.priority}
              className="w-full rounded-xl border px-3 py-3 text-sm"
              style={{
                borderColor: "var(--sand)",
              }}
            />
          </div>

          <label
            className="flex items-start gap-3 rounded-xl border p-4"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <input
              name="requiresHuman"
              type="checkbox"
              defaultChecked={answer.requires_human}
              className="mt-1"
            />

            <div>
              <p className="text-sm font-medium">Escalate to human support</p>

              <p className="text-xs text-gray-500 mt-1">
                Notify a support agent after this automatic response.
              </p>
            </div>
          </label>

          <button
            type="submit"
            className="w-full rounded-full py-3 text-sm font-semibold text-white"
            style={{
              background: "var(--indigo)",
            }}
          >
            Save changes
          </button>
        </form>

        <div
          className="border-t mt-8 pt-6"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          <p className="text-sm font-semibold">Answer status</p>

          <p className="text-xs text-gray-500 mt-1 mb-4">
            Disabled answers are ignored by Teraa Assistant but remain saved.
          </p>

          <form
            action={setSupportAnswerActive.bind(
              null,
              answer.id,
              !answer.active,
            )}
          >
            <button
              type="submit"
              className="rounded-full border px-5 py-2.5 text-sm font-medium"
              style={{
                borderColor: answer.active ? "var(--clay)" : "var(--leaf)",

                color: answer.active ? "var(--clay)" : "var(--leaf)",
              }}
            >
              {answer.active ? "Disable answer" : "Enable answer"}
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
