"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadJobPhotoAction, deleteJobPhotoAction } from "@/actions/jobs";

type Photo = { id: string; url: string; caption: string | null };

export function PhotoUploader({ jobId, kind, photos }: {
  jobId: string; kind: "before" | "after"; photos: Photo[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    start(async () => {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.set("jobId", jobId);
        fd.set("kind", kind);
        fd.set("file", file);
        const res = await uploadJobPhotoAction(fd);
        if (res?.error) { setError(res.error); break; }
      }
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    });
  }

  function remove(id: string) {
    start(async () => { await deleteJobPhotoAction(id); router.refresh(); });
  }

  return (
    <div className="px-4 pb-4">
      {photos.length > 0 && (
        <div className="mb-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((p) => (
            <div key={p.id} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.caption ?? `${kind} photo`}
                   className="aspect-[4/3] w-full rounded border object-cover"
                   style={{ borderColor: "rgb(var(--border))" }} />
              <button onClick={() => remove(p.id)} disabled={pending}
                className="absolute right-1 top-1 rounded bg-bark-950/70 px-1.5 py-0.5 text-2xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                aria-label="Delete photo">Remove</button>
            </div>
          ))}
        </div>
      )}

      <input ref={inputRef} type="file" accept="image/*" multiple capture="environment"
             onChange={(e) => upload(e.target.files)} className="hidden" id={`up-${kind}`} />
      <label htmlFor={`up-${kind}`}
             className={`btn btn-secondary w-full cursor-pointer ${pending ? "opacity-60" : ""}`}>
        {pending ? "Uploading…" : photos.length ? `Add another ${kind} photo` : `Add ${kind} photos`}
      </label>

      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      {photos.length === 0 && !error && (
        <p className="mt-1.5 text-2xs text-faint">
          {kind === "before" ? "Shoot before you start — it settles disputes and doubles as marketing." : "The after shot is what wins the next customer."}
        </p>
      )}
    </div>
  );
}
