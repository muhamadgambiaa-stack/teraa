"use client";

import { useState } from "react";

export function StarRatingInput({
  name = "rating",
  defaultValue = 5,
}: {
  name?: string;
  defaultValue?: number;
}) {
  const [rating, setRating] = useState(defaultValue);
  const [hovered, setHovered] = useState<number | null>(null);

  const visibleRating = hovered ?? rating;

  return (
    <div>
      <input type="hidden" name={name} value={rating} />

      <div
        className="flex items-center gap-1"
        role="radiogroup"
        aria-label="Rating"
        onMouseLeave={() => setHovered(null)}
      >
        {[1, 2, 3, 4, 5].map((value) => {
          const active = value <= visibleRating;

          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value} out of 5`}
              onClick={() => setRating(value)}
              onMouseEnter={() => setHovered(value)}
              className="p-1 rounded-md transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2"
              style={{
                color: "var(--gold)",
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill={active ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m12 2.5 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5-4.7-4.6 6.5-.9L12 2.5Z" />
              </svg>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 mt-1">{getRatingLabel(rating)}</p>
    </div>
  );
}

function getRatingLabel(rating: number) {
  switch (rating) {
    case 1:
      return "Poor";

    case 2:
      return "Fair";

    case 3:
      return "Good";

    case 4:
      return "Very good";

    case 5:
      return "Excellent";

    default:
      return "";
  }
}
