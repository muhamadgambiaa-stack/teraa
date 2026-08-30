"use client";

import { useEffect, useState } from "react";

export function CommissionDeadline({
  dueAt,
  status,
  paused,
}: {
  dueAt: string;
  status: string;
  paused: boolean;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    function updateRemaining() {
      setRemaining(
        Math.max(0, new Date(dueAt).getTime() - Date.now()),
      );
    }

    updateRemaining();

    if (paused || status === "overdue") {
      return;
    }

    const interval = window.setInterval(updateRemaining, 1000);

    return () => window.clearInterval(interval);
  }, [dueAt, paused, status]);

  if (status === "overdue") {
    return (
      <div className="mt-3 rounded-lg bg-red-50 p-3">
        <p className="text-xs font-semibold text-red-700">
          Payment overdue
        </p>
        <p className="mt-1 text-xs text-red-600">
          Selling access remains paused until your payment is approved.
        </p>
      </div>
    );
  }

  if (paused) {
    return (
      <div className="mt-3 rounded-lg bg-blue-50 p-3">
        <p className="text-xs font-semibold text-blue-700">
          Deadline paused
        </p>
        <p className="mt-1 text-xs text-blue-600">
          The countdown will resume after Teraa responds or reviews your proof.
        </p>
      </div>
    );
  }

  if (remaining === null) {
    return (
      <p className="mt-3 text-xs text-gray-500">
        Calculating payment deadline…
      </p>
    );
  }

  if (remaining === 0) {
    return (
      <div className="mt-3 rounded-lg bg-red-50 p-3">
        <p className="text-xs font-semibold text-red-700">
          Deadline reached
        </p>
        <p className="mt-1 text-xs text-red-600">
          Automatic enforcement may take up to five minutes.
        </p>
      </div>
    );
  }

  const totalSeconds = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const urgent = remaining <= 60 * 60 * 1000;

  return (
    <div
      className={`mt-3 rounded-lg p-3 ${
        urgent ? "bg-red-50" : "bg-amber-50"
      }`}
    >
      <p
        className={`text-xs font-semibold ${
          urgent ? "text-red-700" : "text-amber-800"
        }`}
      >
        Time remaining
      </p>

      <p
        className={`mt-1 text-lg font-bold tabular-nums ${
          urgent ? "text-red-700" : "text-amber-900"
        }`}
      >
        {hours.toString().padStart(2, "0")}:
        {minutes.toString().padStart(2, "0")}:
        {seconds.toString().padStart(2, "0")}
      </p>

      <p className="mt-1 text-[11px] text-gray-500">
        Due {new Date(dueAt).toLocaleString()}
      </p>
    </div>
  );
}
