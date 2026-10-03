import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition-[opacity,transform,background-color,box-shadow] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] disabled:pointer-events-none disabled:opacity-40 active:scale-[0.96] min-h-11",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-fg shadow-border hover:opacity-95",
        secondary:
          "bg-surface-2 text-fg shadow-border hover:shadow-border-hover",
        ghost: "bg-transparent text-muted hover:text-fg hover:bg-surface-2",
        danger: "bg-danger/15 text-danger shadow-border",
      },
      size: {
        default: "rounded-md px-4 text-sm",
        lg: "rounded-lg px-5 text-base",
        sm: "min-h-9 rounded-sm px-3 text-sm",
        icon: "size-11 rounded-md p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
