import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { NodeDetailContent } from './NodeDetailContent';
import { Suspense } from 'react';

interface NodeDetailSheetProps {
  internalId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NodeDetailSheet({ internalId, open, onOpenChange }: NodeDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl lg:max-w-2xl overflow-y-auto">
        <SheetHeader className="sr-only">
          <SheetTitle>Node Details</SheetTitle>
        </SheetHeader>
        {internalId != null && (
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-teal-500" />
              </div>
            }
          >
            <NodeDetailContent internalId={internalId} compact />
          </Suspense>
        )}
      </SheetContent>
    </Sheet>
  );
}
