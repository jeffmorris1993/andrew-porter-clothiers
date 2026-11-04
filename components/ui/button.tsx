import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[3px] text-[13px] font-medium tracking-[0.01em] transition-[background,color,border-color,box-shadow] duration-200 disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-navy text-paper hover:bg-navy-soft shadow-[0_1px_0_rgba(0,0,0,.2)]",
        brass: "bg-brass text-raised hover:bg-[#6b5228]",
        outline: "border border-hairline bg-raised text-ink hover:border-brass hover:text-navy",
        ghost: "text-ink-soft hover:bg-sunk hover:text-ink",
        link: "text-navy underline-offset-4 hover:underline px-0",
        danger: "border border-oxblood/30 bg-raised text-oxblood hover:bg-oxblood-wash",
      },
      size: {
        sm: "h-8 px-3 text-[12px]",
        md: "h-10 px-4",
        lg: "h-11 px-6 text-[14px]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...(asChild ? {} : { type: type ?? "button" })}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
