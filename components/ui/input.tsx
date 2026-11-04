import * as React from "react";
import { cn } from "@/lib/utils";

export const fieldClass =
  "w-full rounded-[3px] border border-hairline bg-raised px-3 text-[14px] text-ink placeholder:text-faint transition-colors focus:border-brass focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-brass/20 disabled:opacity-60";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(fieldClass, "h-10", className)} {...props} />,
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(fieldClass, "min-h-[84px] py-2.5 leading-relaxed", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-[12px] font-medium text-ink-soft", className)} {...props} />;
}
