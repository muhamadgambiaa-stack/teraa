export default function Loading() {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-6"
      style={{
        background: "#fffdf8",
      }}
      role="status"
      aria-live="polite"
      aria-label="Loading Teraa"
    >
      <div className="flex flex-col items-center text-center">
        <img
          src="/branding/teraa-icon.svg"
          alt=""
          width="72"
          height="72"
          className="w-16 h-16 sm:w-[72px] sm:h-[72px]"
        />

        <p
          className="font-display text-xl font-semibold mt-3"
          style={{
            color: "var(--indigo)",
          }}
        >
          Teraa
        </p>

        <p className="text-xs text-gray-400 mt-1">
          Loading...
        </p>

        <div
          className="w-32 h-1 rounded-full overflow-hidden mt-5"
          style={{
            background: "var(--sand)",
          }}
        >
          <div
            className="w-2/3 h-full rounded-full animate-pulse"
            style={{
              background: "var(--indigo)",
            }}
          />
        </div>
      </div>
    </div>
  );
}