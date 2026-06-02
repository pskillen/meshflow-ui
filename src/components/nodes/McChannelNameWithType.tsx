import type { McChannelRowDisplay } from '@/lib/mc-channel-editor';

type McChannelNameWithTypeProps = McChannelRowDisplay;

/** Channel name with muted PUBLIC / HASHTAG suffix (MeshCore channel editor lists). */
export function McChannelNameWithType({ label, typeLabel }: McChannelNameWithTypeProps) {
  return (
    <span className="flex min-w-0 items-baseline gap-1.5">
      <span className="truncate font-medium">{label}</span>
      {typeLabel ? <span className="shrink-0 text-xs font-normal text-muted-foreground">{typeLabel}</span> : null}
    </span>
  );
}
