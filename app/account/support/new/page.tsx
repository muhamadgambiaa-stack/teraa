import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";

import { createSupportThread, createSupportThreadFromAnswer } from "../actions";

type SupportQuestion = {
  id: string;
  category: string;
  question: string;
  requires_human: boolean;
  menu_order: number;
};

const CATEGORY_ORDER = [
  "order",
  "delivery",
  "payment",
  "seller_account",
  "account",
  "report",
  "all",
  "other",
];

export default async function NewSupportPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/account/support/new");
  }

  const { data: questionData, error } = await supabase.rpc(
    "get_support_question_menu",
  );

  if (error) {
    console.error("Could not load support questions:", error);
  }

  const questions = (questionData as SupportQuestion[] | null) ?? [];

  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    questions: questions
      .filter((question) => question.category === category)
      .sort((a, b) => a.menu_order - b.menu_order),
  })).filter((group) => group.questions.length > 0);

  return (
    <>
      <SiteHeader />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-28 sm:pb-8">
        <Link
          href="/account/support"
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:underline"
        >
          <ArrowLeftIcon />
          Support
        </Link>

        {/* HEADER */}

        <div className="mt-5 mb-6">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center mb-3"
            style={{
              background: "#e6edf3",
              color: "var(--indigo)",
            }}
          >
            <SupportIcon />
          </div>

          <h1
            className="font-display text-2xl"
            style={{
              color: "var(--ink)",
            }}
          >
            How can we help?
          </h1>

          <p className="text-sm text-gray-500 mt-1 leading-5">
            Choose a question below for an instant answer from Teraa Assistant.
          </p>
        </div>

        {/* QUESTION GROUPS */}

        {groups.length > 0 ? (
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.category}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <CategoryIcon category={group.category} />

                  <h2
                    className="text-xs uppercase tracking-wide font-semibold"
                    style={{
                      color: "var(--ink)",
                    }}
                  >
                    {categoryLabel(group.category)}
                  </h2>
                </div>

                <div
                  className="rounded-xl border bg-white overflow-hidden"
                  style={{
                    borderColor: "var(--sand)",
                  }}
                >
                  {group.questions.map((question) => (
                    <form
                      key={question.id}
                      action={createSupportThreadFromAnswer.bind(
                        null,
                        question.id,
                      )}
                      className="border-b last:border-b-0"
                      style={{
                        borderColor: "var(--sand)",
                      }}
                    >
                      <button
                        type="submit"
                        className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-gray-50 transition"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-5">
                            {question.question}
                          </p>

                          {question.requires_human && (
                            <p
                              className="text-[11px] mt-1"
                              style={{
                                color: "var(--clay)",
                              }}
                            >
                              Human support review
                            </p>
                          )}
                        </div>

                        <ChevronIcon />
                      </button>
                    </form>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div
            className="rounded-xl border bg-white p-6 text-center"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <p className="text-sm font-medium">
              Support questions are currently unavailable.
            </p>

            <p className="text-xs text-gray-500 mt-1">
              You can still send your question below.
            </p>
          </div>
        )}

        {/* CUSTOM QUESTION */}

        <section
          className="mt-8 border-t pt-6"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          <h2
            className="font-display text-lg"
            style={{
              color: "var(--ink)",
            }}
          >
            Can&apos;t find your question?
          </h2>

          <p className="text-sm text-gray-500 mt-1 mb-4">
            Type your question below. Teraa Assistant will try to answer it. If
            it cannot, your conversation will be sent to human support.
          </p>

          <form action={createSupportThread} className="space-y-3">
            <input type="hidden" name="category" value="other" />

            <textarea
              name="message"
              required
              minLength={3}
              maxLength={4000}
              rows={4}
              placeholder="Ask Teraa Support..."
              className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none resize-y"
              style={{
                borderColor: "var(--sand)",
              }}
            />

            <button
              type="submit"
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-white"
              style={{
                background: "var(--indigo)",
              }}
            >
              Send question
            </button>
          </form>
        </section>

        {/* HUMAN SUPPORT NOTE */}

        <div
          className="rounded-xl border p-4 mt-6"
          style={{
            borderColor: "var(--sand)",
            background: "#fbfaf7",
          }}
        >
          <div className="flex items-start gap-3">
            <HumanIcon />

            <div>
              <p className="text-sm font-medium">Need a person?</p>

              <p className="text-xs text-gray-500 mt-1 leading-5">
                You can ask to speak with a human support agent at any time.
                Serious issues such as fraud, account restrictions and safety
                reports are automatically referred to human support.
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

function categoryLabel(category: string) {
  const labels: Record<string, string> = {
    order: "Orders",
    delivery: "Delivery",
    payment: "Payments",
    seller_account: "Seller account",
    account: "Your account",
    report: "Safety & reports",
    all: "General",
    other: "Other",
  };

  return labels[category] ?? category;
}

function CategoryIcon({ category }: { category: string }) {
  const common = {
    width: 15,
    height: 15,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (category === "order") {
    return (
      <svg
        {...common}
        style={{
          color: "var(--indigo)",
        }}
      >
        <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" />
        <path d="m4 7.5 8 4.5 8-4.5" />
      </svg>
    );
  }

  if (category === "delivery") {
    return (
      <svg
        {...common}
        style={{
          color: "var(--indigo)",
        }}
      >
        <path d="M3 6h11v11H3z" />
        <path d="M14 9h4l3 3v5h-7" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
      </svg>
    );
  }

  if (category === "payment") {
    return (
      <svg
        {...common}
        style={{
          color: "var(--indigo)",
        }}
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18" />
      </svg>
    );
  }

  if (category === "seller_account") {
    return (
      <svg
        {...common}
        style={{
          color: "var(--indigo)",
        }}
      >
        <path d="M3 9 5 4h14l2 5" />
        <path d="M5 13v7h14v-7" />
        <path d="M9 20v-5h6v5" />
      </svg>
    );
  }

  if (category === "report") {
    return (
      <svg
        {...common}
        style={{
          color: "var(--indigo)",
        }}
      >
        <path d="M12 3 2.8 20h18.4L12 3Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
    );
  }

  return (
    <svg
      {...common}
      style={{
        color: "var(--indigo)",
      }}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-1 .8-1.7 1.3-1.7 2.7" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function SupportIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 13a8 8 0 0 1 16 0" />
      <path d="M4 13v4a2 2 0 0 0 2 2h2v-6H4Z" />
      <path d="M20 13v4a2 2 0 0 1-2 2h-2v-6h4Z" />
      <path d="M16 19c0 2-2 3-4 3" />
    </svg>
  );
}

function HumanIcon() {
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
      style={{
        background: "#e3f0e8",
        color: "var(--leaf)",
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="8" r="4" />

        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    </div>
  );
}

function ArrowLeftIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-gray-400 shrink-0"
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
