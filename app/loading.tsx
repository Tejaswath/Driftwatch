import SkeletonCard from "@/components/skeleton-card";

export default function LoadingHome() {
  return (
    <div className="space-y-6">
      <SkeletonCard className="h-48" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SkeletonCard className="h-28" />
        <SkeletonCard className="h-28" />
        <SkeletonCard className="h-28" />
        <SkeletonCard className="h-28" />
      </div>
      <SkeletonCard className="h-80" />
      <SkeletonCard className="h-96" />
    </div>
  );
}
