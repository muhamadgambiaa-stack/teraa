import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";

export default async function SupportAnswersPage() {
  const supabase = await createClient();

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

  const { data: answers, error } = await supabase
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
    .order("menu_order", {
      ascending: true,
    })
    .order("priority", {
      ascending: false,
    });

  if (error) {
    console.error("Could not load support answers:", error);
  }

  const activeCount = (answers ?? []).filter((answer) => answer.active).length;

  const menuCount = (answers ?? []).filter(
    (answer) => answer.active && answer.show_in_menu,
  ).length;

  const humanCount = (answers ?? []).filter(
    (answer) => answer.active && answer.requires_human,
  ).length;

  return (
    <>
      <SiteHeader />

      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 sm:pb-8">
        <Link
          href="/admin/support"
          className="text-xs text-gray-500 hover:underline"
        >
          ← Support
        </Link>

        <div className="flex items-start justify-between gap-4 mt-5 mb-6">
          <div>
            <h1
              className="font-display text-2xl"
              style={{
                color: "var(--ink)",
              }}
            >
              Support Answers
            </h1>

            <p className="text-sm text-gray-500 mt-1">
              Control the questions and answers shown by Teraa Assistant.
            </p>
          </div>

          <Link
            href="/admin/support/answers/new"
            className="rounded-full px-4 py-2.5 text-sm font-medium text-white shrink-0"
            style={{
              background: "var(--indigo)",
            }}
          >
            Add answer
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total" value={answers?.length ?? 0} />

          <StatCard label="Active" value={activeCount} />

          <StatCard label="Question menu" value={menuCount} />

          <StatCard label="Human review" value={humanCount} />
        </div>

        {!answers || answers.length === 0 ? (
          <div
            className="rounded-xl border bg-white p-8 text-center"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <p className="font-medium">No support answers</p>
          </div>
        ) : (
          <div className="space-y-3">
            {answers.map((answer) => (
              <Link
                key={answer.id}
                href={`/admin/support/answers/${answer.id}`}
                className="block rounded-xl border bg-white p-4 hover:shadow-sm transition"
                style={{
                  borderColor: "var(--sand)",
                  opacity: answer.active ? 1 : 0.6,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {answer.question || answer.slug}
                    </p>

                    {answer.question && (
                      <p className="text-[11px] text-gray-400 mt-1">
                        {answer.slug}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <Badge>{categoryLabel(answer.category)}</Badge>

                      {answer.show_in_menu && <Badge>Question menu</Badge>}

                      {answer.requires_human && <Badge>Human review</Badge>}
                    </div>
                  </div>

                  <span
                    className="text-[10px] font-semibold rounded-full px-2.5 py-1 shrink-0"
                    style={{
                      background: answer.active ? "#e3f0e8" : "#eeeeee",

                      color: answer.active ? "var(--leaf)" : "#666",
                    }}
                  >
                    {answer.active ? "Active" : "Disabled"}
                  </span>
                </div>

                <p className="text-sm text-gray-600 mt-3 line-clamp-2">
                  {answer.answer}
                </p>

                <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-400 mt-3">
                  <span>{answer.keywords?.length ?? 0} matching phrases</span>

                  <span>Priority {answer.priority}</span>

                  {answer.show_in_menu && (
                    <span>Menu order {answer.menu_order}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function categoryLabel(category: string) {
  const labels: Record<string, string> = {
    all: "General",
    order: "Orders",
    delivery: "Delivery",
    seller_account: "Seller account",
    account: "Account",
    payment: "Payments",
    report: "Safety",
    other: "Other",
  };

  return labels[category] ?? category;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-xl border bg-white p-3"
      style={{
        borderColor: "var(--sand)",
      }}
    >
      <p
        className="text-xl font-bold"
        style={{
          color: "var(--ink)",
        }}
      >
        {value}
      </p>

      <p className="text-[11px] text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="rounded-full px-2 py-1 text-[10px] font-medium"
      style={{
        background: "#f6f6f3",
        color: "var(--indigo)",
      }}
    >
      {children}
    </span>
  );
}
