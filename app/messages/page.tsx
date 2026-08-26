import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";

export default async function MessagesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/messages");
  }

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select(
      `
      id,
      buyer_id,
      seller_id,
      product_id,
      created_at,
      products(
        id,
        title
      )
      `,
    )
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error("Conversation lookup failed:", error);
  }

  const rows = conversations ?? [];

  const participantIds = [
    ...new Set(
      rows.map((conversation) =>
        conversation.buyer_id === user.id
          ? conversation.seller_id
          : conversation.buyer_id,
      ),
    ),
  ];

  let users: {
    id: string;
    full_name: string | null;
  }[] = [];

  if (participantIds.length > 0) {
    const { data } = await supabase
      .from("users")
      .select("id, full_name")
      .in("id", participantIds);

    users = data ?? [];
  }

  const conversationIds = rows.map((conversation) => conversation.id);

  let allMessages: {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    created_at: string;
    read_at: string | null;
  }[] = [];

  if (conversationIds.length > 0) {
    const { data } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, content, created_at, read_at")
      .in("conversation_id", conversationIds)
      .order("created_at", {
        ascending: false,
      });

    allMessages = data ?? [];
  }

  return (
    <>
      <SiteHeader />

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1
            className="font-display text-2xl"
            style={{
              color: "var(--ink)",
            }}
          >
            Messages
          </h1>

          <p className="text-sm text-gray-500 mt-1">
            Chat with buyers and sellers about marketplace listings.
          </p>
        </div>

        {rows.length === 0 ? (
          <div
            className="rounded-xl border p-10 text-center"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <div className="text-3xl mb-3">💬</div>

            <p className="font-medium">No messages yet</p>

            <p className="text-sm text-gray-500 mt-1">
              Your conversations will appear here.
            </p>
          </div>
        ) : (
          <div
            className="rounded-xl border bg-white overflow-hidden"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            {rows.map((conversation) => {
              const otherUserId =
                conversation.buyer_id === user.id
                  ? conversation.seller_id
                  : conversation.buyer_id;

              const otherUser = users.find((entry) => entry.id === otherUserId);

              const messages = allMessages.filter(
                (message) => message.conversation_id === conversation.id,
              );

              const latestMessage = messages[0] ?? null;

              const unreadCount = messages.filter(
                (message) => message.sender_id !== user.id && !message.read_at,
              ).length;

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

              const product = Array.isArray(productRaw)
                ? productRaw[0]
                : productRaw;

              return (
                <Link
                  key={conversation.id}
                  href={`/messages/${conversation.id}`}
                  className="flex items-center gap-3 px-4 py-4 border-b last:border-b-0 hover:bg-gray-50 transition"
                  style={{
                    borderColor: "var(--sand)",
                  }}
                >
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 font-semibold"
                    style={{
                      background: "var(--sand)",
                      color: "var(--indigo)",
                    }}
                  >
                    {(otherUser?.full_name ?? "T").charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium truncate">
                        {otherUser?.full_name ?? "Teraa user"}
                      </p>

                      {latestMessage && (
                        <span className="text-[10px] text-gray-400 shrink-0">
                          {new Date(
                            latestMessage.created_at,
                          ).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {product && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {product.title}
                      </p>
                    )}

                    <div className="flex items-center justify-between gap-3 mt-1">
                      <p className="text-xs text-gray-400 truncate">
                        {latestMessage?.content ?? "Start conversation"}
                      </p>

                      {unreadCount > 0 && (
                        <span
                          className="min-w-5 h-5 rounded-full px-1.5 flex items-center justify-center text-[10px] text-white font-semibold shrink-0"
                          style={{
                            background: "var(--clay)",
                          }}
                        >
                          {unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
