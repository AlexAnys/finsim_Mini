"use client";

import { useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<ComponentProps<"input">, "type" | "ref"> & {
  visibilityLabel: string;
};

export function PasswordInput({ visibilityLabel, className, disabled, onBlur, onKeyDown, onPointerDown, onChange, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef<{ range: [number, number]; value: string } | null>(null);

  useLayoutEffect(() => {
    const input = inputRef.current;
    const selection = selectionRef.current;
    if (!input || !selection || document.activeElement !== input) return;
    const frame = requestAnimationFrame(() => {
      if (selectionRef.current === selection && document.activeElement === input && input.value === selection.value) {
        input.setSelectionRange(...selection.range);
      }
      if (selectionRef.current === selection) selectionRef.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  function toggleVisibility() {
    const input = inputRef.current;
    if (input && document.activeElement === input && input.selectionStart !== null && input.selectionEnd !== null) {
      const pending = selectionRef.current;
      selectionRef.current = pending?.value === input.value ? pending
        : { range: [input.selectionStart, input.selectionEnd], value: input.value };
    } else {
      selectionRef.current = null;
    }
    setVisible((value) => !value);
  }

  return (
    <div className="relative">
      <Input
        {...props}
        ref={inputRef}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={cn("pr-11", className)}
        onBlur={(event) => { selectionRef.current = null; onBlur?.(event); }}
        onKeyDown={(event) => { selectionRef.current = null; onKeyDown?.(event); }}
        onPointerDown={(event) => { selectionRef.current = null; onPointerDown?.(event); }}
        onChange={(event) => { selectionRef.current = null; onChange?.(event); }}
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
