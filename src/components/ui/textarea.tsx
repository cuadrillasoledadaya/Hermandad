import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-slate-300 placeholder:text-muted-foreground focus-visible:border-primary flex field-sizing-content min-h-24 w-full rounded-xl border-2 bg-white px-4 py-3 text-base shadow-sm transition-all outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:ring-0",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
