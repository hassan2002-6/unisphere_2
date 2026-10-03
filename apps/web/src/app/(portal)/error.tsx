"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Error boundary for portal routes — keeps the shell intact and offers a retry. */
export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface for the server logs / Vercel logs without leaking to the UI.
    console.error("Portal error:", error);
  }, [error]);

  return (
    <div className="page items-center justify-center">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>
            This screen failed to load. It&apos;s usually temporary — retry, and if it keeps
            happening the data connection may be down.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={reset}>
              <RotateCcw className="h-4 w-4" />
              Try again
            </Button>
            <Button variant="outline" asChild>
              <a href="/dashboard">Back to dashboard</a>
            </Button>
          </div>
          {error.digest ? (
            <p className="text-xs text-muted-foreground">
              Error reference: <code className="rounded bg-muted px-1 py-0.5">{error.digest}</code>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
