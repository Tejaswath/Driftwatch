"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { RunStatus } from "@/lib/types";

type RunStatusPollerProps = {
  status: RunStatus;
  intervalMs?: number;
};

const TERMINAL_STATUSES = new Set<RunStatus>(["completed", "failed"]);

export default function RunStatusPoller({ status, intervalMs = 5000 }: RunStatusPollerProps) {
  const router = useRouter();

  useEffect(() => {
    if (TERMINAL_STATUSES.has(status)) return;

    const id = setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => clearInterval(id);
  }, [status, intervalMs, router]);

  return null;
}
