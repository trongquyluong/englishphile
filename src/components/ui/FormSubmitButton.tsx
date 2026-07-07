"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type FormSubmitButtonProps = {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
};

export function FormSubmitButton({ children, pendingLabel = "Đang xử lý...", className }: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      disabled={pending}
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-lg bg-foreground px-4 text-sm font-semibold text-background transition-transform duration-150 ease-out active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
