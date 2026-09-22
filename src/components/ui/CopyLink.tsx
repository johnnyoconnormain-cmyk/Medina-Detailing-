"use client";
import { useEffect, useState } from "react";

export function CopyLink({ path }: { path: string }) {
  const [url, setUrl] = useState(path);
  const [copied, setCopied] = useState(false);

  // Built client-side so the link matches whatever host the app is served from.
  useEffect(() => { setUrl(`${window.location.origin}${path}`); }, [path]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked; the input is selectable as a fallback */ }
  }

  return (
    <div className="flex gap-1.5">
      <input readOnly value={url} onFocus={(e) => e.currentTarget.select()}
             className="input tnum !py-1.5 text-2xs" aria-label="Public link" />
      <button type="button" onClick={copy} className="btn btn-secondary flex-none !px-2.5 !py-1.5 text-2xs">
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
