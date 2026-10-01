import Image from "next/image";

// Optimize this project's public storage images. Older external image URLs
// still display directly, without expanding the server's image-fetch allowlist.
function canOptimize(src: string) {
  if (src.startsWith("/") && !src.startsWith("//")) return true;
  const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!storageUrl) return false;
  try {
    const image = new URL(src);
    const project = new URL(storageUrl);
    return image.protocol === "https:" && image.origin === project.origin && image.pathname.startsWith("/storage/v1/object/public/");
  } catch {
    return false;
  }
}

export function ListingImage({ src, alt, sizes, className, loading = "lazy" }: {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  return <Image src={src} alt={alt} fill sizes={sizes} quality={75} loading={loading} unoptimized={!canOptimize(src)} className={className} draggable={false} />;
}
