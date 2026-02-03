import { SkeletonCard } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="p-6 space-y-4">
            <div className="h-8 w-1/3 bg-gray-200 rounded animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
            </div>
        </div>
    );
}
