"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import CountrySelect from "@/components/profile/CountrySelect";
import { resizeImage } from "@/lib/imageResize";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

interface CreateCommunityModalProps {
  artistId: string;
  artistName: string;
  onClose: () => void;
  onCreated: () => void;
}

const TAG_SUGGESTIONS = [
  "Fan Club",
  "Discussion",
  "Covers",
  "Live Shows",
  "Vinyl",
  "Lyrics",
  "Remixes",
  "Setlists",
  "News",
  "Throwbacks",
];

export default function CreateCommunityModal({
  artistId,
  artistName,
  onClose,
  onCreated,
}: CreateCommunityModalProps) {
  const { getToken } = useAuth();
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(`${artistName} Fans`);
  const [country, setCountry] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitLabel, setSubmitLabel] = useState("Create");
  const [error, setError] = useState("");

  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => nameRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (iconPreview) URL.revokeObjectURL(iconPreview);
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    };
  }, []);

  const handleIconChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (iconPreview) URL.revokeObjectURL(iconPreview);
    const resized = await resizeImage(file, 256, 256, true);
    setIconFile(resized);
    setIconPreview(URL.createObjectURL(resized));
    e.target.value = "";
  };

  const handleBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    const resized = await resizeImage(file, 1500, 500, true);
    setBannerFile(resized);
    setBannerPreview(URL.createObjectURL(resized));
    e.target.value = "";
  };

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed) && tags.length < 5) {
      setTags((prev) => [...prev, trimmed]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    }
    if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setSubmitting(true);
    setSubmitLabel("Creating...");
    setError("");

    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/communities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          description: `A community for ${artistName} fans`,
          genre: artistName,
          country: country.trim() || null,
          tags,
          artistId: Number(artistId),
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to create community");
      }

      const created = await res.json();

      if (iconFile) {
        setSubmitLabel("Uploading icon...");
        const form = new FormData();
        form.append("file", iconFile, iconFile.name);
        await fetch(`${API_URL}/communities/${created.id}/icon`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
      }

      if (bannerFile) {
        setSubmitLabel("Uploading banner...");
        const form = new FormData();
        form.append("file", bannerFile, bannerFile.name);
        await fetch(`${API_URL}/communities/${created.id}/banner`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
      }

      toast.success("Community created");
      onCreated();
      router.push(`/discover/community/${created.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
      setSubmitLabel("Create");
    }
  };

  const availableSuggestions = TAG_SUGGESTIONS.filter(
    (s) => !tags.includes(s),
  );

  return (
    <div className="fixed inset-0 z-[110] animate-in fade-in duration-200 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-surface border border-surface-container-high rounded-3xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="text-on-surface font-bold text-lg">
            Create Community
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-on-surface-variant text-lg">
              close
            </span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-5">
          {/* Banner + Icon pickers */}
          <div>
            {/* Banner */}
            <div className="relative">
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                className="w-full h-28 rounded-2xl bg-surface-container-high overflow-hidden border-2 border-dashed border-surface-container-highest hover:border-primary/40 transition-colors flex items-center justify-center group"
              >
                {bannerPreview ? (
                  <img
                    src={bannerPreview}
                    alt="Banner"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-on-surface-variant group-hover:text-on-surface transition-colors">
                    <span className="material-symbols-outlined text-2xl">panorama</span>
                    <span className="text-xs font-medium">Add banner</span>
                  </div>
                )}
                {bannerPreview && (
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-2xl">edit</span>
                  </div>
                )}
              </button>

              {/* Icon overlapping banner */}
              <button
                type="button"
                onClick={() => iconInputRef.current?.click()}
                className="absolute -bottom-6 left-4 w-14 h-14 rounded-2xl bg-surface-container-high border-2 border-surface overflow-hidden hover:border-primary/40 transition-colors flex items-center justify-center group shadow-md"
              >
                {iconPreview ? (
                  <img
                    src={iconPreview}
                    alt="Icon"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="material-symbols-outlined text-on-surface-variant text-xl group-hover:text-on-surface transition-colors">
                    add_photo_alternate
                  </span>
                )}
                {iconPreview && (
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                    <span className="material-symbols-outlined text-white text-base">edit</span>
                  </div>
                )}
              </button>
            </div>

            {/* Spacer to clear the overlapping icon */}
            <div className="h-8" />

            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBannerChange}
            />
            <input
              ref={iconInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleIconChange}
            />
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5 block">
              Community Name
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              className="w-full bg-surface-container-high rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-outline border-none outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
              placeholder="e.g. Eminem Superfans"
            />
          </div>

          {/* Country */}
          <div>
            <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5 block">
              Country
            </label>
            <CountrySelect value={country} onChange={setCountry} placeholder="Select a country..." />
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5 block">
              Tags{" "}
              <span className="text-outline font-normal normal-case">
                (up to 5)
              </span>
            </label>

            {/* Tag chips + input */}
            <div className="flex flex-wrap gap-2 bg-surface-container-high rounded-xl px-3 py-2.5 min-h-[44px] items-center focus-within:ring-2 focus-within:ring-primary/30 transition-shadow">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 rounded-full"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:text-primary/70 transition-colors"
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 14 }}
                    >
                      close
                    </span>
                  </button>
                </span>
              ))}
              {tags.length < 5 && (
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  className="flex-1 min-w-[100px] bg-transparent border-none outline-none text-sm text-on-surface placeholder:text-outline"
                  placeholder={tags.length === 0 ? "Type and press Enter" : ""}
                />
              )}
            </div>

            {/* Suggestions */}
            {availableSuggestions.length > 0 && tags.length < 5 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {availableSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addTag(s)}
                    className="text-xs text-on-surface-variant bg-surface-container px-2.5 py-1 rounded-full hover:bg-surface-container-high transition-colors"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-500 font-medium">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-on-surface-variant bg-surface-container-high hover:bg-surface-container transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-on-primary bg-primary hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? submitLabel : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
