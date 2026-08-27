import Link from "next/link";

import { SiteHeader } from "@/components/SiteHeader";

type Section = {
  title: string;
  paragraphs?: string[];
  items?: string[];
};

export function PolicyPage({
  title,
  intro,
  lastUpdated,
  sections,
}: {
  title: string;
  intro: string;
  lastUpdated: string;
  sections: Section[];
}) {
  return (
    <>
      <SiteHeader />

      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 sm:pb-10">
        <div className="mb-8">
          <p
            className="text-xs font-medium mb-2"
            style={{
              color: "var(--indigo)",
            }}
          >
            Teraa
          </p>

          <h1
            className="font-display text-2xl sm:text-3xl"
            style={{
              color: "var(--ink)",
            }}
          >
            {title}
          </h1>

          <p className="text-sm text-gray-600 mt-3 leading-6">{intro}</p>

          <p className="text-xs text-gray-400 mt-3">
            Last updated: {lastUpdated}
          </p>
        </div>

        <div className="space-y-7">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-xl border bg-white p-4 sm:p-5"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              <h2
                className="font-semibold text-base"
                style={{
                  color: "var(--ink)",
                }}
              >
                {section.title}
              </h2>

              {section.paragraphs?.map((paragraph) => (
                <p
                  key={paragraph}
                  className="text-sm text-gray-600 mt-3 leading-6"
                >
                  {paragraph}
                </p>
              ))}

              {section.items && (
                <ul className="mt-3 space-y-2.5">
                  {section.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-sm text-gray-600 leading-6"
                    >
                      <span
                        className="mt-2.25 w-1.5 h-1.5 rounded-full shrink-0"
                        style={{
                          background: "var(--indigo)",
                        }}
                      />

                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <footer
          className="mt-10 pt-6 border-t text-center"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-gray-500">
            <Link href="/terms" className="hover:underline">
              Terms
            </Link>

            <Link href="/privacy" className="hover:underline">
              Privacy
            </Link>

            <Link href="/marketplace-rules" className="hover:underline">
              Marketplace Rules
            </Link>

            <Link href="/safety" className="hover:underline">
              Safety
            </Link>
          </div>

          <p className="text-[11px] text-gray-400 mt-3">© 2026 Teraa</p>
        </footer>
      </main>
    </>
  );
}
