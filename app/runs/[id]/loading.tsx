import SkeletonCard from "@/components/skeleton-card";

export default function LoadingRunDetails() {
  return (
    <div className="space-y-6">
      <SkeletonCard className="h-6 w-72" />
      <SkeletonCard className="h-44" />
      <SkeletonCard className="h-36" />
      <SkeletonCard className="h-72" />
      <SkeletonCard className="h-[360px]" />
    </div>
  );
}
