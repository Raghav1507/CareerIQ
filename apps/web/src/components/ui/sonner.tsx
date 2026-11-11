"use client";

import { Toaster as SonnerToaster } from "sonner";

type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

export function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "rounded-lg border bg-popover text-popover-foreground shadow-lg",
        },
      }}
      {...props}
    />
  );
}
