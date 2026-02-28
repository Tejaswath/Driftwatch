type SkeletonCardProps = {
  className?: string;
};

export default function SkeletonCard({ className = "" }: SkeletonCardProps) {
  return <div className={`animate-pulse rounded-lg border border-[#E5E5E5] bg-[#F4F4F4] ${className}`} />;
}
