import { Suspense } from "react";
import { TriggersPage } from "@/src/features/triggers/triggers_page";
import { Skeleton } from "@/components/ui/skeleton";

function TriggersPageFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-surface-base">
      <Skeleton className="h-12 w-48 rounded-lg" />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<TriggersPageFallback />}>
      <TriggersPage />
    </Suspense>
  );
}
