import React from 'react';

export const LinkCardSkeleton = () => (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-4 animate-pulse">
    <div className="flex flex-col lg:flex-row lg:items-start gap-4">
      {/* QR Code Skeleton */}
      <div className="w-[72px] h-[72px] sm:w-[96px] sm:h-[96px] bg-white/10 rounded-xl shrink-0 self-center lg:self-start"></div>

      {/* Link Info Skeleton */}
      <div className="flex-1 space-y-3 w-full">
        {/* Title */}
        <div className="h-6 bg-white/10 rounded-lg w-1/3"></div>
        {/* Original URL */}
        <div className="h-4 bg-white/5 rounded-lg w-2/3"></div>
        {/* Short URL / Badges */}
        <div className="flex items-center gap-2 pt-2">
          <div className="h-5 bg-white/10 rounded-lg w-1/4"></div>
          <div className="h-5 bg-white/5 rounded-full w-16"></div>
          <div className="h-5 bg-white/5 rounded-full w-16"></div>
        </div>
      </div>

      {/* Action Buttons Skeleton */}
      <div className="flex flex-row lg:flex-col gap-2 shrink-0 self-center lg:self-start mt-4 lg:mt-0">
        <div className="h-9 w-24 bg-white/10 rounded-lg"></div>
        <div className="h-9 w-9 bg-white/5 rounded-lg hidden lg:block"></div>
        <div className="h-9 w-9 bg-white/5 rounded-lg hidden lg:block"></div>
      </div>
    </div>
  </div>
);

export const DashboardSkeleton = () => (
  <div className="space-y-6 w-full">
    {/* Header Skeleton */}
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 bg-white/10 rounded-lg w-48 animate-pulse"></div>
          <div className="h-4 bg-white/5 rounded-lg w-32 animate-pulse"></div>
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-24 bg-white/10 rounded-xl animate-pulse"></div>
          <div className="h-10 w-24 bg-white/10 rounded-xl animate-pulse"></div>
        </div>
      </div>
    </div>
    
    {/* Stats Block Skeleton */}
    <div className="p-4 rounded-xl border border-white/10 bg-white/5 h-24 animate-pulse w-full"></div>

    {/* Search & Action Row Skeleton */}
    <div className="flex items-center justify-between w-full">
      <div className="h-12 w-full sm:max-w-md bg-white/10 rounded-xl animate-pulse"></div>
    </div>

    {/* Links List Skeletons */}
    <div className="mt-6">
      <LinkCardSkeleton />
      <LinkCardSkeleton />
      <LinkCardSkeleton />
      <LinkCardSkeleton />
    </div>
  </div>
);
