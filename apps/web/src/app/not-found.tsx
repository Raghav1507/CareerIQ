import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Compass className="h-6 w-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        The page you are looking for does not exist or has moved.
      </p>
      <Button className="mt-6" asChild>
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
