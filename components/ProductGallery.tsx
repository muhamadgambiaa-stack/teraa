"use client";

import { useRef, useState } from "react";

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
  const touchStartX = useRef<number | null>(null);

  const selectedPhoto = photos[selectedIndex] ?? photos[0] ?? null;

  function selectPrevious() {
    setSelectedIndex((current) =>
      current === 0 ? photos.length - 1 : current - 1,
    );
  }

  function selectNext() {
    setSelectedIndex((current) =>
      current === photos.length - 1 ? 0 : current + 1,
    );
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    if (touchStartX.current === null || photos.length < 2) return;

    const distance = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(distance) < 45) return;

    if (distance < 0) {
      selectNext();
    } else {
      selectPrevious();
    }
  }

  return (
    <section className="w-full max-w-[420px] mx-auto md:mx-0">
      <div
        className="relative w-full rounded-xl overflow-hidden flex items-center justify-center select-none"
        style={{
          background: "var(--sand)",
          aspectRatio: "4 / 3",
          touchAction: "pan-y",
        }}
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0].clientX;
        }}
        onTouchEnd={handleTouchEnd}
      >
        {selectedPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={selectedPhoto.photo_url}
            alt={title}
            draggable={false}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full min-h-[220px] flex flex-col items-center justify-center text-gray-400">
            <ImageIcon />

            <p className="text-xs mt-2">No photo provided</p>
          </div>
        )}

        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={selectPrevious}
              aria-label="View previous photo"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/90 shadow flex items-center justify-center text-xl"
              style={{ color: "var(--indigo)" }}
            >
              ‹
            </button>

            <button
              type="button"
              onClick={selectNext}
              aria-label="View next photo"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/90 shadow flex items-center justify-center text-xl"
              style={{ color: "var(--indigo)" }}
            >
              ›
            </button>

            <span className="absolute right-2 bottom-2 rounded-full bg-black/65 px-2.5 py-1 text-xs font-medium text-white">
              {selectedIndex + 1} / {photos.length}
            </span>
          </>
        )}
      </div>

      {photos.length > 1 && (
        <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
          {photos.map((photo, index) => (
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
        <p className="text-xs text-gray-500 mt-1.5 text-center sm:text-left">
          Swipe the large photo or tap a thumbnail.
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
