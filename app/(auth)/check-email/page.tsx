import Link from "next/link";

import { AuthPageShell } from "@/components/AuthPageShell";

type PageProps = {
  searchParams: Promise<{
    email?: string;
  }>;
};

export default async function CheckEmailPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const email = params.email;

  return (
    <AuthPageShell wide>
      <div className="text-center">
        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full text-2xl"
          style={{
            background: "#e8eef5",
            color: "var(--indigo)",
          }}
        >
          ✉
        </div>

        <h1
          className="font-display text-3xl mb-3"
          style={{ color: "var(--indigo)" }}
        >
          Check your email
        </h1>

        <p className="text-gray-600 leading-7">
          We sent a verification link
          {email ? (
            <>
              {" "}
              to <span className="font-medium text-gray-900">{email}</span>
            </>
          ) : null}
          .
        </p>

        <p className="text-gray-600 leading-7 mt-2">
          Open the email and confirm your account to continue using Teraa.
        </p>

        <div className="mt-7">
          <Link
            href="/login"
            className="inline-flex rounded-full px-6 py-3 text-white text-sm font-medium"
            style={{ background: "var(--indigo)" }}
          >
            Back to login
          </Link>
        </div>

        <p className="text-xs text-gray-500 mt-6">
          If you don&apos;t see the email, check your spam or junk folder.
        </p>
      </div>
    </AuthPageShell>
  );
}
