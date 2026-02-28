import SkeletonCard from "@/components/skeleton-card";

export default function LoadingRuns() {
  return (
    <div className="space-y-6">
      <SkeletonCard className="h-10 w-64" />
      <SkeletonCard className="h-28" />
      <SkeletonCard className="h-[420px]" />
    </div>
  );
}
