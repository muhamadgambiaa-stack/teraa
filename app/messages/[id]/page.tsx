import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";

import { markConversationRead, sendMessage } from "./actions";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/messages/${id}`);
  }

  const { data: conversation, error } = await supabase
    .from("conversations")
    .select(
      `
      id,
      buyer_id,
      seller_id,
      product_id,
      products(
        id,
        title
      )
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !conversation) {
    notFound();
  }

  if (conversation.buyer_id !== user.id && conversation.seller_id !== user.id) {
    notFound();
  }

  const otherUserId =
    conversation.buyer_id === user.id
      ? conversation.seller_id
      : conversation.buyer_id;

  const { data: otherUser } = await supabase
    .from("users")
    .select("id, full_name")
    .eq("id", otherUserId)
    .maybeSingle();

  const { data: messages } = await supabase
    .from("messages")
    .select(
      `
      id,
      sender_id,
      content,
      created_at,
      read_at
      `,
    )
    .eq("conversation_id", conversation.id)
    .order("created_at", {
      ascending: true,
    });

  await markConversationRead(conversation.id);

  const productRaw = (
    conversation as {
      products?:
        | {
            id: string;
            title: string;
          }
        | {
            id: string;
            title: string;
          }[];
    }
  ).products;

  const product = Array.isArray(productRaw) ? productRaw[0] : productRaw;

  return (
    <>
      <SiteHeader />

      <main className="max-w-2xl mx-auto px-4 py-5">
        <div className="flex items-center gap-3 mb-5">
          <Link href="/messages" className="text-xl">
            ←
          </Link>

          <div>
            <h1 className="font-semibold">
              {otherUser?.full_name ?? "Teraa user"}
            </h1>

            {product && (
              <Link
                href={`/products/${product.id}`}
                className="text-xs text-gray-500 hover:underline"
              >
                {product.title}
              </Link>
            )}
          </div>
        </div>

        <div className="space-y-3 mb-5">
          {(messages ?? []).length === 0 && (
            <div className="text-center py-10">
              <p className="text-sm text-gray-500">
                No messages yet. Start the conversation.
              </p>
            </div>
          )}

          {(messages ?? []).map((message) => {
            const mine = message.sender_id === user.id;

            return (
              <div
                key={message.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[80%] rounded-2xl px-4 py-2.5"
                  style={{
                    background: mine ? "var(--indigo)" : "#f3f4f6",
                    color: mine ? "white" : "var(--ink)",
                  }}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.content}
                  </p>

                  <p
                    className="text-[10px] mt-1"
                    style={{
                      color: mine ? "#dbe4ee" : "#9ca3af",
                    }}
                  >
                    {new Date(message.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <form
          action={sendMessage.bind(null, conversation.id)}
          className="sticky bottom-20 sm:bottom-0 bg-white pt-2 pb-2"
        >
          <div
            className="flex items-end gap-2 rounded-2xl border p-2 bg-white"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <textarea
              name="content"
              required
              maxLength={2000}
              rows={1}
              placeholder="Write a message..."
              className="flex-1 resize-none outline-none text-sm px-2 py-2"
            />

            <button
              type="submit"
              className="rounded-full px-4 py-2 text-sm text-white font-medium shrink-0"
              style={{
                background: "var(--indigo)",
              }}
            >
              Send
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
