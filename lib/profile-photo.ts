export const PROFILE_PHOTO_BUCKET = "profile-photos";
export const PROFILE_PHOTO_UPDATED_EVENT = "teraa:profile-photo-updated";

export type ProfilePhotoUpdatedDetail = {
  photoUrl: string | null;
  fullName?: string | null;
};

export function profilePhotoPathFromUrl(url: string | null) {
  if (!url) return null;

  const marker = `/storage/v1/object/public/${PROFILE_PHOTO_BUCKET}/`;
  const markerIndex = url.indexOf(marker);

  if (markerIndex === -1) return null;

  const encodedPath = url.slice(markerIndex + marker.length);

  try {
    return decodeURIComponent(encodedPath);
  } catch {
    return encodedPath;
  }
}
