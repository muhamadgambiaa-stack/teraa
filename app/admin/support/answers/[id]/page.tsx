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

  /* ============================================================
     AUTH
  ============================================================ */

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc(
    "current_user_is_admin",
  );

  if (adminError || !isAdmin) {
    redirect("/");
  }

  /* ============================================================
     LOAD ANSWER
  ============================================================ */

  const { data: answer, error } = await supabase
    .from("support_answers")
    .select(
      `
        id,
        slug,
        category,
        question,
        keywords,
        answer,
        requires_human,
        priority,
        show_in_menu,
        menu_order,
        active,
        updated_at
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Could not load support answer:", error);
  }

  if (!answer) {
    notFound();
  }

  /* ============================================================
     PAGE
  ============================================================ */

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

        {/* HEADER */}

        <div className="flex items-start justify-between gap-4 mt-5 mb-6">
          <div className="min-w-0">
            <h1
              className="font-display text-2xl"
              style={{
                color: "var(--ink)",
              }}
            >
              Edit Support Answer
            </h1>

            <p className="text-sm text-gray-500 mt-1">
              Control the clickable question, automatic answer and human
              escalation.
            </p>
          </div>

          <span
            className="rounded-full px-2.5 py-1 text-xs font-semibold shrink-0"
            style={{
              background: answer.active ? "#e3f0e8" : "#eeeeee",

              color: answer.active ? "var(--leaf)" : "#666",
            }}
          >
            {answer.active ? "Active" : "Disabled"}
          </span>
        </div>

        {/* EDIT FORM */}

        <form
          action={updateSupportAnswer.bind(null, answer.id)}
          className="space-y-5"
        >
          {/* QUESTION */}

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Question shown to users
            </label>

            <input
              name="question"
              type="text"
              maxLength={200}
              defaultValue={answer.question ?? ""}
              placeholder="Example: Can I pay with Wave?"
              className="w-full rounded-xl border bg-white px-3 py-3 text-sm outline-none"
              style={{
                borderColor: "var(--sand)",
              }}
            />

            <p className="text-xs text-gray-500 mt-1">
              This is the question users see and click in Contact Support.
            </p>
          </div>

          {/* SHOW IN MENU */}

          <label
            className="flex items-start gap-3 rounded-xl border bg-white p-4 cursor-pointer"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <input
              name="showInMenu"
              type="checkbox"
              defaultChecked={answer.show_in_menu}
              className="mt-1"
            />

            <div>
              <p className="text-sm font-medium">Show in question menu</p>

              <p className="text-xs text-gray-500 mt-1 leading-5">
                Users will be able to click this question directly from Contact
                Support.
              </p>
            </div>
          </label>

          {/* CATEGORY */}

          <div>
            <label className="block text-sm font-medium mb-1.5">Category</label>

            <select
              name="category"
              required
              defaultValue={answer.category}
              className="w-full rounded-xl border bg-white px-3 py-3 text-sm outline-none"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              <option value="all">General</option>

              <option value="order">Orders</option>

              <option value="delivery">Delivery</option>

              <option value="payment">Payments</option>

              <option value="seller_account">Seller account</option>

              <option value="account">Account</option>

              <option value="report">Safety & reports</option>

              <option value="other">Other</option>
            </select>
          </div>

          {/* MENU ORDER */}

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Menu order
            </label>

            <input
              name="menuOrder"
              type="number"
              required
              min={0}
              max={1000}
              defaultValue={answer.menu_order}
              className="w-full rounded-xl border bg-white px-3 py-3 text-sm outline-none"
              style={{
                borderColor: "var(--sand)",
              }}
            />

            <p className="text-xs text-gray-500 mt-1">
              Lower numbers appear first inside the category.
            </p>
          </div>

          {/* SLUG */}

          <div>
            <label className="block text-sm font-medium mb-1.5">Slug</label>

            <input
              name="slug"
              type="text"
              required
              minLength={3}
              maxLength={100}
              defaultValue={answer.slug}
              className="w-full rounded-xl border bg-white px-3 py-3 text-sm outline-none"
              style={{
                borderColor: "var(--sand)",
              }}
            />

            <p className="text-xs text-gray-500 mt-1">
              Lowercase letters, numbers and hyphens only.
            </p>
          </div>

          {/* KEYWORDS */}

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Matching phrases
            </label>

            <textarea
              name="keywords"
              required
              rows={10}
              defaultValue={(answer.keywords ?? []).join("\n")}
              className="w-full rounded-xl border bg-white px-3 py-3 text-sm outline-none resize-y"
              style={{
                borderColor: "var(--sand)",
              }}
            />

            <p className="text-xs text-gray-500 mt-1 leading-5">
              Put one phrase on each line. These are used when users type their
              own questions.
            </p>
          </div>

          {/* ANSWER */}

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
              className="w-full rounded-xl border bg-white px-3 py-3 text-sm outline-none resize-y"
              style={{
                borderColor: "var(--sand)",
              }}
            />

            <p className="text-xs text-gray-500 mt-1">
              This is the approved response Teraa Assistant sends.
            </p>
          </div>

          {/* MATCH PRIORITY */}

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Matching priority
            </label>

            <input
              name="priority"
              type="number"
              required
              min={0}
              max={1000}
              defaultValue={answer.priority}
              className="w-full rounded-xl border bg-white px-3 py-3 text-sm outline-none"
              style={{
                borderColor: "var(--sand)",
              }}
            />

            <p className="text-xs text-gray-500 mt-1">
              Higher priority answers win when typed questions match more than
              one rule.
            </p>
          </div>

          {/* HUMAN SUPPORT */}

          <label
            className="flex items-start gap-3 rounded-xl border bg-white p-4 cursor-pointer"
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

              <p className="text-xs text-gray-500 mt-1 leading-5">
                Teraa Assistant sends the automatic answer, then the
                conversation is placed in the human support queue.
              </p>
            </div>
          </label>

          {/* SAVE */}

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

        {/* ENABLE / DISABLE */}

        <div
          className="border-t mt-8 pt-6"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          <p className="text-sm font-semibold">Answer status</p>

          <p className="text-xs text-gray-500 mt-1 mb-4 leading-5">
            Disabled answers disappear from the question menu and are ignored by
            Teraa Assistant.
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
