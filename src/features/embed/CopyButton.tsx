import { useEffect, useRef, useState } from "react";

/**
 * Clipboard write with a visible confirmation, and a fallback for the cases where the async
 * Clipboard API is unavailable -- it needs a secure context, so it is present on https and
 * localhost but not, for example, on a plain-http preview host.
 */
async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path rather than reporting failure on a permissions prompt.
  }

  try {
    const scratch = document.createElement("textarea");
    scratch.value = text;
    scratch.setAttribute("readonly", "");
    scratch.style.position = "fixed";
    scratch.style.opacity = "0";
    document.body.appendChild(scratch);
    scratch.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(scratch);
    return copied;
  } catch {
    return false;
  }
}

export function CopyButton({
  value,
  label = "Copy",
  className = "",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  async function handleClick() {
    const copied = await writeToClipboard(value);
    setState(copied ? "copied" : "failed");
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex-none rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
        state === "copied"
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : state === "failed"
            ? "border-red-300 bg-red-50 text-red-700"
            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      } ${className}`}
    >
      {/* aria-live so a screen reader hears the confirmation, which is otherwise purely visual. */}
      <span aria-live="polite">
        {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : label}
      </span>
    </button>
  );
}
