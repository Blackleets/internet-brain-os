import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-12 w-full rounded-md bg-surface-2 px-4 text-base text-fg shadow-border placeholder:text-subtle",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full resize-none rounded-lg bg-surface-2 px-4 py-3 text-base text-fg shadow-border placeholder:text-subtle",
        className,
      )}
      suppressHydrationWarning
      {...props}
    />
  );
}
