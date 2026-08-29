"use client";

import { useState } from "react";

type ProductPhoto = {
  photo_url: string;
  is_cover: boolean;
  sort_order: number;
};

export function ProductGallery({
  photos,
  title,
}: {
  photos: ProductPhoto[];
  title: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectedPhoto = photos[selectedIndex] ?? photos[0] ?? null;

  return (
    <section className="w-full max-w-[420px] mx-auto md:mx-0">
      <div
        className="w-full rounded-xl overflow-hidden flex items-center justify-center"
        style={{
          background: "var(--sand)",
          aspectRatio: "4 / 3",
        }}
      >
        {selectedPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={selectedPhoto.photo_url}
            alt={title}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full min-h-[220px] flex flex-col items-center justify-center text-gray-400">
            <ImageIcon />

            <p className="text-xs mt-2">No photo provided</p>
          </div>
        )}
      </div>

      {photos.length > 1 && (
        <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
          {photos.slice(0, 6).map((photo, index) => (
            <button
              key={`${photo.photo_url}-${index}`}
              type="button"
              onClick={() => setSelectedIndex(index)}
              aria-label={`View ${title} photo ${index + 1}`}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg border shrink-0 overflow-hidden bg-white"
              style={{
                borderColor:
                  selectedIndex === index
                    ? "var(--indigo)"
                    : "var(--sand)",
                borderWidth: selectedIndex === index ? "2px" : "1px",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.photo_url}
                alt={`${title} thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {photos.length > 1 && (
        <p className="text-[11px] text-gray-400 mt-1.5">
          Tap a photo to view it.
        </p>
      )}
    </section>
  );
}

function ImageIcon() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="m21 15-5-5L5 20" />
    </svg>
  );
}
