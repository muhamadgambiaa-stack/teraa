import type { OrderStatus } from "@/types/database";

const ORDER_STEPS: { status: OrderStatus; label: string }[] = [
  { status: "placed", label: "Placed" },
  { status: "confirmed", label: "Confirmed" },
  { status: "shipped", label: "Shipped" },
  { status: "delivered", label: "Delivered" },
  { status: "completed", label: "Completed" },
];

export function OrderProgress({ status }: { status: OrderStatus }) {
  if (status === "cancelled") {
    return (
      <div className="rounded-lg bg-gray-100 px-3 py-2 text-center text-xs font-medium text-gray-600">
        This order will not progress because it was cancelled.
      </div>
    );
  }

  const currentIndex = ORDER_STEPS.findIndex((step) => step.status === status);

  return (
    <div className="w-full" aria-label={`Order status: ${status}`}>
      <div className="flex items-start">
        {ORDER_STEPS.map((step, index) => {
          const reached = index <= currentIndex;
          const current = index === currentIndex;

          return (
            <div key={step.status} className="relative flex-1 text-center">
              {index > 0 && (
                <span
                  className="absolute right-1/2 top-[7px] h-0.5 w-full"
                  style={{
                    background:
                      index <= currentIndex ? "var(--leaf)" : "var(--sand)",
                  }}
                />
              )}

              <span
                className="relative z-10 mx-auto block h-4 w-4 rounded-full border-2 bg-white"
                style={{
                  borderColor: reached ? "var(--leaf)" : "var(--sand)",
                  background: current ? "var(--leaf)" : "white",
                }}
              />

              <span
                className="mt-1.5 block text-[9px] sm:text-[10px] leading-tight"
                style={{
                  color: reached ? "var(--ink)" : "#6b7280",
                  fontWeight: current ? 700 : 500,
                }}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
