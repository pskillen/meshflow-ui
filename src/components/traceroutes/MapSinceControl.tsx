import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface MapSinceControlProps {
  /** Active custom start date, or null. */
  since: Date | null;
  /** Called with `YYYY-MM-DD`, or null to clear. */
  onChange: (date: string | null) => void;
}

/** Custom range for the traceroute maps: a "since" date in a dialog. See MapSinceControl.md. */
export function MapSinceControl({ since, onChange }: MapSinceControlProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <>
      <Button
        type="button"
        variant={since ? 'secondary' : 'outline'}
        size="sm"
        className="h-8"
        data-testid="map-since-button"
        onClick={() => {
          setDraft(since ? format(since, 'yyyy-MM-dd') : '');
          setOpen(true);
        }}
      >
        <CalendarIcon className="mr-1.5 h-4 w-4" />
        {since ? `Since ${format(since, 'd MMM yyyy')}` : 'Custom'}
      </Button>
      {since && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Clear custom range"
          onClick={() => onChange(null)}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Custom range</DialogTitle>
            <DialogDescription>Show traceroutes triggered from this date up to now.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="map-since-date">Since</Label>
            <Input
              id="map-since-date"
              type="date"
              max={today}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!draft}
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
