"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { ServiceId } from "@/lib/services";
import { Workspace } from "./Workspace";

function Inner({ serviceId }: { serviceId: ServiceId }) {
  const sp = useSearchParams();
  const taskId = sp.get("task") ?? undefined;
  const autorun = sp.get("run") === "1";
  return <Workspace key={taskId ?? "new"} serviceId={serviceId} taskId={taskId} autorun={autorun} />;
}

export function ServiceWorkspace({ serviceId }: { serviceId: ServiceId }) {
  return (
    <Suspense fallback={null}>
      <Inner serviceId={serviceId} />
    </Suspense>
  );
}
