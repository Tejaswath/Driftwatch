"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";

type CopyRunIdButtonProps = {
  runId: string;
};

export default function CopyRunIdButton({ runId }: CopyRunIdButtonProps) {
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(runId);
      toast.success("Run ID copied to clipboard");
    } catch {
      toast.error("Unable to copy Run ID");
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className="text-[#6B7280] transition-colors hover:text-nordea-navy"
      aria-label="Copy run ID"
    >
      <Copy size={14} />
    </button>
  );
}
