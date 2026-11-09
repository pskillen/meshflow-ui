import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { windowForTimeRangeKey } from '@/lib/time-range';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export interface TimeRangeOption {
  key: string;
  label: string;
}

interface TimeRangeSelectProps {
  options: TimeRangeOption[];
  value: string;
  onChange: (value: string, timeRange: { startDate: Date; endDate: Date }) => void;
  className?: string;
}

export function TimeRangeSelect({ options, value, onChange, className }: TimeRangeSelectProps) {
  const handleTimeRangeChange = (newValue: string) => {
    const { startDate, endDate } = windowForTimeRangeKey(newValue, new Date());
    onChange(newValue, { startDate, endDate });
  };

  return (
    <div className={className}>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={handleTimeRangeChange}
        variant="outline"
        className="@[767px]/card:flex hidden"
      >
        {options.map((option) => (
          <ToggleGroupItem key={option.key} value={option.key} className="h-8 px-2.5">
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Select value={value} onValueChange={handleTimeRangeChange}>
        <SelectTrigger className="@[767px]/card:hidden flex w-40" aria-label="Select time range">
          <SelectValue placeholder="Select range" />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {options.map((option) => (
            <SelectItem key={option.key} value={option.key} className="rounded-lg">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
