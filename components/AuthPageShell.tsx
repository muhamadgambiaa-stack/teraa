import Image from "next/image";
import Link from "next/link";

type AuthPageShellProps = {
  children: React.ReactNode;
  wide?: boolean;
};

export function AuthPageShell({ children, wide = false }: AuthPageShellProps) {
  return (
    <main
      className="flex min-h-[100dvh] items-center justify-center px-3 py-6 sm:px-4 sm:py-10"
      style={{ background: "var(--paper)" }}
    >
      <div className={`w-full ${wide ? "max-w-md" : "max-w-sm"}`}>
        <div className="mb-4 flex items-center justify-between gap-4 px-1">
          <Link href="/" aria-label="Teraa marketplace home">
            <Image
              src="/branding/teraa-logo.svg"
              alt="Teraa"
              width={760}
              height={180}
              priority
              className="h-8 w-auto"
            />
          </Link>

          <Link
            href="/"
            className="inline-flex min-h-10 items-center rounded-full px-3 text-xs font-semibold transition hover:bg-white"
            style={{ color: "var(--indigo)" }}
          >
            <span aria-hidden="true">←</span>
            <span className="ml-1.5">Marketplace</span>
          </Link>
        </div>

        <section
          className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6"
          style={{ borderColor: "var(--sand)" }}
        >
          {children}
        </section>
      </div>
    </main>
  );
}
