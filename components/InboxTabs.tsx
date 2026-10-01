import Link from "next/link";

export function InboxTabs({ active }: { active: "messages" | "notifications" }) {
  return (
    <nav aria-label="Inbox" className="mb-5 flex gap-2 rounded-xl bg-gray-100 p-1">
      {(["messages", "notifications"] as const).map((tab) => (
        <Link key={tab} href={`/${tab}`} aria-current={active === tab ? "page" : undefined}
          className={`flex-1 rounded-lg px-3 py-2.5 text-center text-sm font-medium ${active === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"}`}>
          {tab === "messages" ? "Messages" : "Notifications"}
        </Link>
      ))}
    </nav>
  );
}
