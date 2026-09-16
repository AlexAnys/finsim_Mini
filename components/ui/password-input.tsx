"use client";

import { useRef, useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<ComponentProps<"input">, "type" | "ref"> & {
  visibilityLabel: string;
};

export function PasswordInput({ visibilityLabel, className, disabled, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function toggleVisibility() {
    const input = inputRef.current;
    const focused = document.activeElement === input;
    const start = input?.selectionStart ?? null;
    const end = input?.selectionEnd ?? null;
    setVisible((value) => !value);
    if (focused) {
      requestAnimationFrame(() => {
        input?.focus({ preventScroll: true });
        if (start !== null && end !== null) input?.setSelectionRange(start, end);
      });
    }
  }

  return (
    <div className="relative">
      <Input
        {...props}
        ref={inputRef}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={cn("pr-11", className)}
      />
      <button
        type="button"
        aria-label={`${visible ? "隐藏" : "显示"}${visibilityLabel}`}
        aria-controls={props.id}
        aria-pressed={visible}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={toggleVisibility}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-ink-4 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
      >
        {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </div>
  );
}
