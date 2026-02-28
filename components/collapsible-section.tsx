"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

type CollapsibleSectionProps = {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export default function CollapsibleSection({
  title,
  defaultOpen = true,
  children
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="rounded-lg border border-[#E5E5E5] bg-white">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <h2 className="text-lg font-bold text-nordea-navy">{title}</h2>
        <span className="text-[#6B7280]">{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
      </button>
      {isOpen ? <div className="px-6 pb-6">{children}</div> : null}
    </section>
  );
}
