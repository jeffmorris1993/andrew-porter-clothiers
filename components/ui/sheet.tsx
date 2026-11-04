"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

export function SheetContent({
  className,
  children,
  title,
  description,
  ...props
}: React.ComponentProps<typeof Dialog.Content> & { title: string; description?: string }) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/25 backdrop-blur-[2px] data-[state=open]:animate-[rise_.3s_ease]" />
      <Dialog.Content
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-[520px] flex-col border-l border-hairline bg-paper shadow-pop focus:outline-none",
          "data-[state=open]:animate-[rise_.35s_var(--ease)]",
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b border-hairline px-6 py-5">
          <div>
            <Dialog.Title className="font-display text-[26px] leading-tight text-ink">{title}</Dialog.Title>
            {description ? (
              <Dialog.Description className="mt-1 text-[12.5px] text-muted">{description}</Dialog.Description>
            ) : (
              <Dialog.Description className="sr-only">{title}</Dialog.Description>
            )}
          </div>
          <Dialog.Close
            className="rounded-[3px] p-1.5 text-muted transition-colors hover:bg-sunk hover:text-ink"
            aria-label="Close"
          >
            <X className="size-4" />
          </Dialog.Close>
        </div>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}
