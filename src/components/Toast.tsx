"use client";

export function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-foreground px-4 py-3 text-sm text-background shadow-lg">
      {message}
    </div>
  );
}
