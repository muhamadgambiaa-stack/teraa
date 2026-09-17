type UserAvatarProps = {
  name?: string | null;
  photoUrl?: string | null;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
};

export function UserAvatar({
  name,
  photoUrl,
  alt = "",
  className = "h-10 w-10",
  fallbackClassName = "text-sm",
}: UserAvatarProps) {
  const initial = name?.trim().charAt(0).toUpperCase() || "T";

  return (
    <span
      className={`relative inline-flex shrink-0 overflow-hidden rounded-full bg-[#1f3d5c] ${className}`}
    >
      {photoUrl ? (
        // Profile photos use a user-selected Supabase Storage URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={alt}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span
          className={`flex h-full w-full items-center justify-center font-bold text-white ${fallbackClassName}`}
          aria-hidden={alt ? undefined : true}
          role={alt ? "img" : undefined}
          aria-label={alt || undefined}
        >
          {initial}
        </span>
      )}
    </span>
  );
}
