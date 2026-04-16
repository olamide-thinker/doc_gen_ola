import React from 'react';
import { DocData } from '../types';
import { cn } from '../lib/utils';

interface ThumbnailProps {
  data: DocData;
  className?: string;
}

/**
 * A miniature, CSS-only preview of the invoice document.
 * Provides a "thumbnail" feel without the overhead of image generation.
 */
export const DocumentThumbnail: React.FC<ThumbnailProps> = ({ data, className }) => {
  return (
    <div className={cn("w-full h-full p-4 bg-white flex flex-col gap-2 overflow-hidden shadow-inner select-none", className)}>
      {/* Header mock */}
      <div className="flex justify-center mb-2">
        <div className="w-12 h-4 bg-slate-100 rounded-sm" />
      </div>

      {/* Info mock */}
      <div className="flex justify-between mb-4">
        <div className="space-y-1">
          <div className="w-16 h-1.5 bg-slate-100 rounded-full" />
          <div className="w-20 h-1 bg-slate-50 rounded-full" />
          <div className="w-12 h-1 bg-slate-50 rounded-full" />
        </div>
        <div className="space-y-1">
          <div className="w-16 h-1.5 bg-slate-100 rounded-full" />
          <div className="w-10 h-1 bg-slate-50 rounded-full" />
        </div>
      </div>

      {/* Title mock */}
      <div className="self-center w-3/4 h-2 bg-slate-100 rounded-full mb-4" />

      {/* Table mock */}
      <div className="border border-slate-50 rounded-sm overflow-hidden">
        <div className="bg-slate-900/5 h-3 w-full" />
        <div className="p-1 space-y-1">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex justify-between gap-2">
              <div className="w-4 h-1 bg-slate-100 rounded-full" />
              <div className="flex-1 h-1 bg-slate-50 rounded-full" />
              <div className="w-6 h-1 bg-slate-100 rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Footer mock */}
      {data.isReceipt ? (
        <div className="mt-auto pt-2 border-t border-slate-50 flex justify-between items-end">
          <div className="flex flex-col gap-1 w-1/2">
            <div className="w-3/4 h-1 bg-slate-100 rounded-full" />
            <div className="w-1/2 h-1 bg-slate-50 rounded-full" />
          </div>
          <div className="flex flex-col items-center gap-1">
             <div className="w-12 h-4 border-b border-slate-100 bg-slate-50/50" />
             <div className="w-10 h-1 bg-slate-100 rounded-full" />
          </div>
        </div>
      ) : (
        <div className="mt-auto pt-2 border-t border-slate-50 flex flex-col gap-1">
          <div className="w-1/2 h-1 bg-slate-50 rounded-full" />
          <div className="w-full h-1 bg-slate-50 rounded-full" />
        </div>
      )}
    </div>
  );
};
