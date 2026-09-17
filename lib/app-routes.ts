const SIMPLE_LAYOUT_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/check-email",
  "/onboarding",
];

export function usesSimpleLayout(pathname: string) {
  return SIMPLE_LAYOUT_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
