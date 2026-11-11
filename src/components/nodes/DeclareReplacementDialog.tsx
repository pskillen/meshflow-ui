import { useRef, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { NodeSearch } from '@/components/NodeSearch';
import { useDeclareNodeReplacement } from '@/hooks/api/useNodeIdentityLinks';
import type { ObservedNode } from '@/lib/models';
import { identityLinkErrorMessage } from './identityLinkErrors';

interface Picked {
  node_id_str: string;
  label: string;
}

/**
 * "Declare a replacement": the owner (or staff) says this node now uses a different node number, picked from a
 * search. Posts `{new_node: "!hex"}` to the old node's identity-links endpoint. See NodeIdentityLinksSection.md.
 */
export function DeclareReplacementDialog({
  internalId,
  node,
  isStaff,
}: {
  internalId: string;
  node: Pick<ObservedNode, 'node_id_str' | 'short_name'>;
  isStaff: boolean;
}) {
  const declare = useDeclareNodeReplacement(internalId);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Synchronous guard: `isPending` only updates on the next render, so a fast double-click would send twice.
  const inFlight = useRef(false);

  const reset = () => {
    setPicked(null);
    setError(null);
  };

  const submit = () => {
    if (!picked || inFlight.current) return;
    inFlight.current = true;
    setError(null);
    declare.mutate(picked.node_id_str, {
      onSuccess: () => {
        setOpen(false);
        reset();
      },
      onError: (err) => setError(identityLinkErrorMessage(err, 'Could not save that. Try again.')),
      onSettled: () => {
        inFlight.current = false;
      },
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (declare.isPending) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          Declare a replacement
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Declare a replacement</DialogTitle>
          <DialogDescription>
            Pick the node that this radio ({node.node_id_str}) uses now.{' '}
            {isStaff ? 'Staff can link any two nodes.' : 'Both nodes must be yours: claim the new one first.'}
          </DialogDescription>
        </DialogHeader>
        <NodeSearch
          displayValue={picked?.label ?? null}
          onClearSelection={() => setPicked(null)}
          onNodeSelect={(_id, n) => {
            if (!n?.node_id_str) return;
            const name = n.long_name || n.short_name;
            setPicked({ node_id_str: n.node_id_str, label: name ? `${n.node_id_str} (${name})` : n.node_id_str });
          }}
        />
        {error ? (
          <Alert variant="destructive" className="text-foreground" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={declare.isPending} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!picked || declare.isPending} onClick={submit}>
            Declare replacement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
