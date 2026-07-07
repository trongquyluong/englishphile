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
    <button disabled={pending} className={cn("btn btn-primary", className)}>
      {pending ? pendingLabel : children}
    </button>
  );
}
