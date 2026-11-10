import { useState } from 'react';
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

const toIsoDay = (d: Date) => d.toISOString().slice(0, 10);
const label = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Custom range for the traceroute maps: a "since" date in a dialog. See MapSinceControl.md. */
export function MapSinceControl({ since, onChange }: MapSinceControlProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const today = toIsoDay(new Date());

  return (
    <>
      <Button
        type="button"
        variant={since ? 'secondary' : 'outline'}
        size="sm"
        className="h-8"
        data-testid="map-since-button"
        onClick={() => {
          setDraft(since ? toIsoDay(since) : '');
          setOpen(true);
        }}
      >
        <CalendarIcon className="mr-1.5 h-4 w-4" />
        {since ? `Since ${label(since)}` : 'Custom'}
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
            <DialogDescription>
              Show traceroutes triggered from the start of this day (UTC) up to now.
            </DialogDescription>
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
