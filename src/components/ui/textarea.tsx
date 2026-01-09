import * as React from "react";

import { cn } from "@/lib/utils";

<<<<<<< HEAD
export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;
=======
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}
>>>>>>> f90644cdeefd6be224926a581cb731aa56204a3f

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
