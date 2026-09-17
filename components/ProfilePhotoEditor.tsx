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

  async function removePhoto() {
    if (!photoUrl || working) return;

    setWorking(true);
    setError(null);

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

    const { error: updateError } = await supabase
      .from("users")
      .update({ profile_photo_url: null })
      .eq("id", user.id);

    if (updateError) {
      console.error("Profile photo removal failed:", updateError);
      setWorking(false);
      setError("Couldn't remove your profile image. Please try again.");
      return;
    }

    const objectPath = profilePhotoPathFromUrl(photoUrl);

    if (objectPath) {
      const { error: storageError } = await supabase.storage
        .from(PROFILE_PHOTO_BUCKET)
        .remove([objectPath]);

      if (storageError) {
        console.error("Could not remove the profile photo file:", storageError);
      }
    }

    onPhotoChange(null);
    announceProfilePhoto({ photoUrl: null, fullName });
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
            <CameraIcon />
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

      <div className="mt-2 flex items-center justify-center gap-2 text-[11px]">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={working}
          className="font-semibold disabled:opacity-60"
          style={{ color: "var(--indigo)" }}
        >
          {photoUrl ? "Change" : "Add photo"}
        </button>

        {photoUrl ? (
          <button
            type="button"
            onClick={removePhoto}
            disabled={working}
            className="text-gray-500 underline decoration-gray-300 underline-offset-2 disabled:opacity-60"
          >
            Remove
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="mt-1.5 text-[11px] leading-4 text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function CameraIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M14.5 5 13 3h-2L9.5 5H6a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3h-3.5Z" />
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  );
}
