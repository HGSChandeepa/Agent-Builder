import { Suspense } from "react";
import { IntegrationsPage } from "@/src/features/integrations/integrations_page";
import { Skeleton } from "@/components/ui/skeleton";

function IntegrationsPageFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-surface-base">
      <Skeleton className="h-12 w-48 rounded-lg" />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<IntegrationsPageFallback />}>
      <IntegrationsPage />
    </Suspense>
  );
}
