import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { nodeDetailPathFromLookupChoice } from '@/lib/node-detail-routes';
import type { ObservedNodeLookupChoice } from '@/lib/observed-node-lookup';
import { MESHCORE_CONFIG, MESHTASTIC_CONFIG } from '@/lib/mesh-protocol';

type NodeLookupPickerProps = {
  lookupId: string;
  choices: ObservedNodeLookupChoice[];
};

export function NodeLookupPicker({ lookupId, choices }: NodeLookupPickerProps) {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Which node did you mean?</CardTitle>
          <CardDescription>
            The id <span className="font-mono text-foreground">{lookupId}</span> matches nodes on more than one
            protocol. Choose one to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {choices.map((choice) => {
            const path = nodeDetailPathFromLookupChoice(choice);
            const label =
              choice.long_name || choice.short_name
                ? `${choice.long_name || ''}${choice.short_name ? ` (${choice.short_name})` : ''}`.trim()
                : choice.node_id_str;
            const isMeshtastic = choice.protocol === 1;
            const section = isMeshtastic ? MESHTASTIC_CONFIG.labels.section : MESHCORE_CONFIG.labels.section;
            if (!path) {
              return null;
            }
            return (
              <Button
                key={choice.internal_id}
                size="lg"
                variant="outline"
                className="h-auto min-h-14 flex-col items-start gap-1 py-4 text-left"
                asChild
              >
                <Link
                  to={path}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(path, { replace: true });
                  }}
                >
                  <span className="text-base font-semibold">{section}</span>
                  <span className="font-mono text-sm text-muted-foreground">{choice.node_id_str}</span>
                  {label ? <span className="text-sm">{label}</span> : null}
                </Link>
              </Button>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
