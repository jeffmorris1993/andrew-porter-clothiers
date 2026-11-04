import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10.5px] font-medium uppercase tracking-[0.1em] whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-hairline bg-raised text-muted",
        sage: "border-sage/25 bg-sage-wash text-sage",
        amber: "border-amber/25 bg-amber-wash text-amber",
        oxblood: "border-oxblood/25 bg-oxblood-wash text-oxblood",
        brass: "border-brass/30 bg-brass-wash text-brass",
        navy: "border-navy bg-navy text-paper",
        slate: "border-hairline bg-slate-wash text-ink-soft",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
