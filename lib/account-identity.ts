type DatabaseLikeError = {
  code?: string;
  message?: string;
};

export function accountIdentityErrorMessage(error: unknown) {
  const databaseError = error as DatabaseLikeError | null;
  const message = databaseError?.message?.toLowerCase() ?? "";

  if (
    databaseError?.code === "23505" ||
    message.includes("users_unique_active_phone_number") ||
    message.includes("duplicate key")
  ) {
    return "That phone number already belongs to a Teraa account. Log in to the existing account to change it, or contact support.";
  }

  return error instanceof Error
    ? error.message
    : databaseError?.message || "Something went wrong.";
}
