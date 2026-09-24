import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useMeshflowApi } from '@/hooks/api/useApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { M2MKey, M2MKeyCreated } from '@/lib/models';

export function ApiAccessPage() {
  const api = useMeshflowApi();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [intendedUse, setIntendedUse] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [created, setCreated] = useState<M2MKeyCreated | null>(null);
  const [error, setError] = useState<string | null>(null);

  const keysQuery = useQuery({
    queryKey: ['m2m-keys'],
    queryFn: () => api.getM2MKeys(),
    retry: false,
  });

  const termsQuery = useQuery({
    queryKey: ['m2m-terms'],
    queryFn: () => api.getM2MTerms(),
    enabled: keysQuery.isSuccess,
  });

  const createKey = useMutation({
    mutationFn: () => api.createM2MKey({ name, intended_use: intendedUse, accept_terms: true }),
    onSuccess: (key) => {
      setCreated(key);
      setName('');
      setIntendedUse('');
      setAgreed(false);
      queryClient.invalidateQueries({ queryKey: ['m2m-keys'] });
    },
    onError: () => setError('Could not create the key.'),
  });

  const revokeKey = useMutation({
    mutationFn: (id: string) => api.revokeM2MKey(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['m2m-keys'] }),
  });

  const acceptTerms = useMutation({
    mutationFn: (id: string) => api.acceptM2MTerms(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['m2m-keys'] }),
  });

  const denied = keysQuery.error && (keysQuery.error as { response?: { status?: number } }).response?.status === 403;

  if (keysQuery.isLoading) {
    return <p className="p-6">Loading developer API access…</p>;
  }

  if (denied) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Developer API</h1>
        <p>
          The public data API is for approved non-commercial dashboards. Ask a Meshflow admin to add you to the m2m_api
          group. Feeder radio keys stay on <Link to="/user/api-keys">API Keys</Link>.
        </p>
      </div>
    );
  }

  const keys = (keysQuery.data ?? []) as M2MKey[];
  const needsTerms = keys.some((key) => key.terms_action_required && !key.revoked_at);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Developer API</h1>
        <p className="text-sm text-muted-foreground">
          Machine-to-machine keys for <code>/api/m2m/v1/</code>. Keep the secret on a server. Data is CC BY-NC 4.0.
        </p>
      </div>

      {needsTerms && (
        <Card>
          <CardHeader>
            <CardTitle>Terms need re-acceptance</CardTitle>
            <CardDescription>
              Existing keys keep working for 90 days, then return 403 until you re-accept.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {created && (
        <Card>
          <CardHeader>
            <CardTitle>Copy this key now</CardTitle>
            <CardDescription>It will not be shown again. Do not put it in browser JavaScript.</CardDescription>
          </CardHeader>
          <CardContent>
            <code data-testid="m2m-secret">{created.key}</code>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your keys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {keys.length === 0 && <p>No keys yet.</p>}
          {keys.map((key) => (
            <div key={key.id} className="flex items-center justify-between gap-3 border-b py-2">
              <div>
                <div className="font-medium">{key.name}</div>
                <div className="text-xs text-muted-foreground">
                  mfk_{key.prefix}… · today {key.requests_today} · 30d {key.requests_30d}
                  {key.revoked_at ? ' · revoked' : ''}
                </div>
              </div>
              <div className="flex gap-2">
                {key.terms_action_required && !key.revoked_at && (
                  <Button size="sm" variant="outline" onClick={() => acceptTerms.mutate(key.id)}>
                    Re-accept terms
                  </Button>
                )}
                {!key.revoked_at && (
                  <Button size="sm" variant="destructive" onClick={() => revokeKey.mutate(key.id)}>
                    Revoke
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create a key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {termsQuery.data && <pre className="whitespace-pre-wrap text-sm">{termsQuery.data.text}</pre>}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />I agree
          </label>
          <div>
            <Label htmlFor="m2m-name">Name</Label>
            <Input id="m2m-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="m2m-use">Intended use</Label>
            <Input id="m2m-use" value={intendedUse} onChange={(event) => setIntendedUse(event.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            disabled={!agreed || !name || !intendedUse || createKey.isPending}
            onClick={() => {
              setError(null);
              createKey.mutate();
            }}
          >
            Create key
          </Button>
          <p className="text-sm">
            Attribution snippet: <code>Data: Meshflow</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
