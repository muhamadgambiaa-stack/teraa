"use client";

import { useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import {
  PROFILE_PHOTO_BUCKET,
  PROFILE_PHOTO_UPDATED_EVENT,
  profilePhotoPathFromUrl,
  type ProfilePhotoUpdatedDetail,
} from "@/lib/profile-photo";
import { UserAvatar } from "@/components/UserAvatar";

const MAX_PROFILE_PHOTO_BYTES = 3 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const FILE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type ProfilePhotoEditorProps = {
  fullName: string | null;
  photoUrl: string | null;
  onPhotoChange: (photoUrl: string | null) => void;
};

function announceProfilePhoto(detail: ProfilePhotoUpdatedDetail) {
  window.dispatchEvent(
    new CustomEvent<ProfilePhotoUpdatedDetail>(PROFILE_PHOTO_UPDATED_EVENT, {
      detail,
    }),
  );
}

export function ProfilePhotoEditor({
  fullName,
  photoUrl,
  onPhotoChange,
}: ProfilePhotoEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePhotoSelection(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) return;

    setError(null);

    if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
      setError("Choose a JPG, PNG or WebP image.");
      return;
    }

    if (file.size > MAX_PROFILE_PHOTO_BYTES) {
      setError("Your profile image must be smaller than 3 MB.");
      return;
    }

    setWorking(true);

    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setWorking(false);
      setError("Your session has expired. Please log in again.");
      return;
    }

    const extension = FILE_EXTENSIONS[file.type];
    const objectPath = `${user.id}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(PROFILE_PHOTO_BUCKET)
      .upload(objectPath, file, {
        cacheControl: "31536000",
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Profile photo upload failed:", uploadError);
      setWorking(false);
      setError("Couldn't upload that image. Please try again.");
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from(PROFILE_PHOTO_BUCKET)
      .getPublicUrl(objectPath);

    const newPhotoUrl = publicUrlData.publicUrl;
    const { error: updateError } = await supabase
      .from("users")
      .update({ profile_photo_url: newPhotoUrl })
      .eq("id", user.id);

    if (updateError) {
      await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([objectPath]);
      console.error("Profile photo profile update failed:", updateError);
      setWorking(false);
      setError("Couldn't save your profile image. Please try again.");
      return;
    }

    const previousObjectPath = profilePhotoPathFromUrl(photoUrl);

    if (previousObjectPath && previousObjectPath !== objectPath) {
      const { error: cleanupError } = await supabase.storage
        .from(PROFILE_PHOTO_BUCKET)
        .remove([previousObjectPath]);

      if (cleanupError) {
        console.error("Could not remove the previous profile photo:", cleanupError);
      }
    }

    onPhotoChange(newPhotoUrl);
    announceProfilePhoto({ photoUrl: newPhotoUrl, fullName });
    setWorking(false);
  }

  return (
    <div className="w-24 shrink-0 text-center">
      <div className="relative mx-auto h-20 w-20">
        <UserAvatar
          name={fullName}
          photoUrl={photoUrl}
          alt={fullName ? `${fullName}'s profile image` : "Profile image"}
          className="h-20 w-20 ring-2 ring-white shadow-sm"
          fallbackClassName="text-2xl"
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={working}
          aria-label={photoUrl ? "Change profile image" : "Add profile image"}
          className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-white shadow-sm disabled:cursor-wait disabled:opacity-70"
          style={{ background: "var(--indigo)" }}
        >
          {working ? (
            <span
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"
              aria-hidden="true"
            />
          ) : (
            <PencilIcon />
          )}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handlePhotoSelection}
        className="sr-only"
        tabIndex={-1}
      />

      {error ? (
        <p className="mt-1.5 text-[11px] leading-4 text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function PencilIcon() {
  return (
    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </svg>
  );
}
