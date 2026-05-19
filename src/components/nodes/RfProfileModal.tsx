import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ObservedNode, RfProfileUpdateBody } from '@/lib/models';
import { useMapTileUrl } from '@/hooks/useMapTileUrl';
import { useRecomputeRfPropagation, useRfProfile, useUpdateRfProfile } from '@/hooks/api/useRfPropagation';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface RfProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: ObservedNode;
}

function numOrUndef(v: string): number | undefined {
  const t = v.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function numOrNull(v: string): number | null {
  const t = v.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Supported ISM bands for propagation (MHz). */
const RF_FREQUENCY_BANDS = [433, 868, 915] as const;

function mhzToBandKey(mhz: number | null | undefined): string {
  if (mhz == null) return '';
  for (const b of RF_FREQUENCY_BANDS) {
    if (Math.abs(mhz - b) < 0.5) return String(b);
  }
  return '';
}

const inputSurfaceClass = 'border border-slate-300 bg-background shadow-sm dark:border-slate-500 dark:bg-background';

/** Radix Select value when no band chosen (keeps Select controlled; not sent to API). */
const FREQ_BAND_UNSET = '__freq_unset__';

export function RfProfileModal({ open, onOpenChange, node }: RfProfileModalProps) {
  const nodeId = node.meshtastic_node_id;
  const { data: profile, isLoading } = useRfProfile(nodeId, { enabled: open });
  const updateMutation = useUpdateRfProfile(nodeId);
  const recomputeMutation = useRecomputeRfPropagation(nodeId);
  const { url: tileUrl, attribution } = useMapTileUrl();

  const [antennaHeight, setAntennaHeight] = useState('');
  const [antennaGain, setAntennaGain] = useState('');
  const [txPower, setTxPower] = useState('');
  /** One of 433 | 868 | 915 or '' when unset / legacy value */
  const [freqBand, setFreqBand] = useState('');
  const [rfLat, setRfLat] = useState('');
  const [rfLng, setRfLng] = useState('');
  const [rfAlt, setRfAlt] = useState('');
  const [coordSnapshot, setCoordSnapshot] = useState<{ lat: string; lng: string; alt: string } | null>(null);
  const [confirmRerenderOpen, setConfirmRerenderOpen] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    if (open) setConfirmRerenderOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open || profile === undefined) return;
    if (profile === null) {
      setAntennaHeight('');
      setAntennaGain('');
      setTxPower('');
      setFreqBand('');
      setRfLat('');
      setRfLng('');
      setRfAlt('');
      setCoordSnapshot({ lat: '', lng: '', alt: '' });
      return;
    }
    setAntennaHeight(profile.antenna_height_m != null ? String(profile.antenna_height_m) : '');
    setAntennaGain(profile.antenna_gain_dbi != null ? String(profile.antenna_gain_dbi) : '');
    setTxPower(profile.tx_power_dbm != null ? String(profile.tx_power_dbm) : '');
    setFreqBand(mhzToBandKey(profile.rf_frequency_mhz));
    const latS = profile.rf_latitude != null ? String(profile.rf_latitude) : '';
    const lngS = profile.rf_longitude != null ? String(profile.rf_longitude) : '';
    const altS = profile.rf_altitude_m != null ? String(profile.rf_altitude_m) : '';
    setRfLat(latS);
    setRfLng(lngS);
    setRfAlt(altS);
    setCoordSnapshot({ lat: latS, lng: lngS, alt: altS });
  }, [open, profile]);

  const initialCenter = useMemo(() => {
    const lat = node.latest_position?.latitude;
    const lng = node.latest_position?.longitude;
    if (lat != null && lng != null) return { lat, lng };
    return { lat: 55.8642, lng: -4.2518 };
  }, [node.latest_position?.latitude, node.latest_position?.longitude]);

  const destroyRfMap = () => {
    markerRef.current?.remove();
    markerRef.current = null;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    tileLayerRef.current = null;
    if (mapRef.current) mapRef.current.innerHTML = '';
  };

  // Leaflet must not initialize while the dialog container has 0×0 size (Radix zoom animation),
  // or tiles never paint. Wait for layout via ResizeObserver + invalidateSize after open.
  useEffect(() => {
    if (!open) {
      destroyRfMap();
      return;
    }
    if (isLoading || profile === undefined) return;

    const el = mapRef.current;
    if (!el) return;

    let disposed = false;

    const tryCreateMap = () => {
      if (disposed || mapInstanceRef.current) return;
      if (el.clientWidth < 8 || el.clientHeight < 8) return;

      const startLat = profile !== null && profile.rf_latitude != null ? profile.rf_latitude : initialCenter.lat;
      const startLng = profile !== null && profile.rf_longitude != null ? profile.rf_longitude : initialCenter.lng;

      const map = L.map(el).setView([startLat, startLng], 13);
      const tileLayer = L.tileLayer(tileUrl, { attribution }).addTo(map);
      tileLayerRef.current = tileLayer;
      const marker = L.marker([startLat, startLng], { draggable: true }).addTo(map);
      markerRef.current = marker;
      marker.on('dragend', () => {
        const p = marker.getLatLng();
        setRfLat(String(p.lat));
        setRfLng(String(p.lng));
      });
      map.on('click', (e) => {
        marker.setLatLng(e.latlng);
        setRfLat(String(e.latlng.lat));
        setRfLng(String(e.latlng.lng));
      });
      mapInstanceRef.current = map;

      const bump = () => map.invalidateSize();
      requestAnimationFrame(() => {
        bump();
        requestAnimationFrame(bump);
      });
      const timings = window.setTimeout(() => {
        bump();
      }, 220);
      const timings2 = window.setTimeout(() => bump(), 600);

      return () => {
        window.clearTimeout(timings);
        window.clearTimeout(timings2);
      };
    };

    let timeoutCleanups: (() => void) | undefined;

    const ro = new ResizeObserver(() => {
      if (disposed) return;
      const map = mapInstanceRef.current;
      if (map) {
        map.invalidateSize();
      } else {
        timeoutCleanups?.();
        timeoutCleanups = tryCreateMap();
      }
    });
    ro.observe(el);

    timeoutCleanups?.();
    timeoutCleanups = tryCreateMap();

    let pollUntil = 0;
    const poll = window.setInterval(() => {
      if (disposed || mapInstanceRef.current || pollUntil++ > 80) {
        window.clearInterval(poll);
        return;
      }
      timeoutCleanups?.();
      timeoutCleanups = tryCreateMap();
    }, 50);

    return () => {
      disposed = true;
      window.clearInterval(poll);
      timeoutCleanups?.();
      ro.disconnect();
      destroyRfMap();
    };
  }, [open, isLoading, profile, initialCenter.lat, initialCenter.lng, tileUrl, attribution]);

  useEffect(() => {
    if (!open) return;
    const map = mapInstanceRef.current;
    const old = tileLayerRef.current;
    if (!map || !old) return;
    map.removeLayer(old);
    const next = L.tileLayer(tileUrl, { attribution }).addTo(map);
    tileLayerRef.current = next;
  }, [open, tileUrl, attribution]);

  useEffect(() => {
    const marker = markerRef.current;
    const lat = numOrUndef(rfLat);
    const lng = numOrUndef(rfLng);
    if (marker && lat != null && lng != null) {
      marker.setLatLng([lat, lng]);
    }
  }, [rfLat, rfLng]);

  const copyFromGps = () => {
    const lat = node.latest_position?.latitude;
    const lng = node.latest_position?.longitude;
    const alt = node.latest_position?.altitude;
    if (lat == null || lng == null) {
      toast.message('No GPS position on latest status for this node.');
      return;
    }
    setRfLat(String(lat));
    setRfLng(String(lng));
    if (alt != null) setRfAlt(String(alt));
    toast.success('Copied coordinates from latest GPS');
  };

  const buildBody = (): RfProfileUpdateBody => ({
    antenna_height_m: numOrNull(antennaHeight),
    antenna_gain_dbi: numOrNull(antennaGain),
    tx_power_dbm: numOrNull(txPower),
    rf_frequency_mhz: freqBand === '' ? null : Number(freqBand),
    antenna_pattern: 'omni',
    antenna_azimuth_deg: null,
    antenna_beamwidth_deg: null,
    rf_latitude: numOrNull(rfLat),
    rf_longitude: numOrNull(rfLng),
    rf_altitude_m: numOrNull(rfAlt),
  });

  const coordsChangedVsSnapshot = () => {
    if (!coordSnapshot) return false;
    return rfLat !== coordSnapshot.lat || rfLng !== coordSnapshot.lng || rfAlt !== coordSnapshot.alt;
  };

  const handleSave = async () => {
    try {
      const needsRerender = coordsChangedVsSnapshot();
      await updateMutation.mutateAsync(buildBody());
      toast.success('RF profile saved');
      onOpenChange(false);
      if (needsRerender) setConfirmRerenderOpen(true);
    } catch {
      toast.error('Could not save RF profile.');
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>RF propagation profile</DialogTitle>
            <DialogDescription>
              Private map location is visible only to you and staff. Antenna parameters are public on the node page.
            </DialogDescription>
          </DialogHeader>

          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

          {!isLoading && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Private location (only you and staff)</CardTitle>
                  <CardDescription>Used for propagation modelling, not the same as live GPS.</CardDescription>
                </CardHeader>
                <div className="space-y-3 px-6 pb-6">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={copyFromGps}>
                      Copy from GPS
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <Label htmlFor="rf-lat">Latitude</Label>
                      <Input
                        id="rf-lat"
                        type="number"
                        inputMode="decimal"
                        step="any"
                        className={inputSurfaceClass}
                        value={rfLat}
                        onChange={(e) => setRfLat(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="rf-lng">Longitude</Label>
                      <Input
                        id="rf-lng"
                        type="number"
                        inputMode="decimal"
                        step="any"
                        className={inputSurfaceClass}
                        value={rfLng}
                        onChange={(e) => setRfLng(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="rf-alt">Altitude (m)</Label>
                      <Input
                        id="rf-alt"
                        type="number"
                        inputMode="decimal"
                        step="any"
                        className={inputSurfaceClass}
                        value={rfAlt}
                        onChange={(e) => setRfAlt(e.target.value)}
                      />
                    </div>
                  </div>
                  <div
                    ref={mapRef}
                    data-testid="rf-profile-map"
                    className="map-container z-0 h-[220px] min-h-[220px] min-w-[200px] w-full rounded-md border border-slate-300 dark:border-slate-500"
                    style={{ position: 'relative', isolation: 'isolate' }}
                  />
                </div>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Antenna</CardTitle>
                </CardHeader>
                <div className="grid grid-cols-1 gap-3 px-6 pb-6 sm:grid-cols-2">
                  <div>
                    <Label>Height AGL (m)</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      className={inputSurfaceClass}
                      value={antennaHeight}
                      onChange={(e) => setAntennaHeight(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Gain (dBi)</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      className={inputSurfaceClass}
                      value={antennaGain}
                      onChange={(e) => setAntennaGain(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>TX power (dBm)</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      className={inputSurfaceClass}
                      value={txPower}
                      onChange={(e) => setTxPower(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="rf-frequency-band">Frequency</Label>
                    <Select
                      value={freqBand === '' ? FREQ_BAND_UNSET : freqBand}
                      onValueChange={(v) => setFreqBand(v === FREQ_BAND_UNSET ? '' : v)}
                    >
                      <SelectTrigger id="rf-frequency-band" className={inputSurfaceClass}>
                        <SelectValue placeholder="Select band" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={FREQ_BAND_UNSET}>Select band</SelectItem>
                        {RF_FREQUENCY_BANDS.map((mhz) => (
                          <SelectItem key={mhz} value={String(mhz)}>
                            {mhz} MHz
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-xs text-muted-foreground">ISM bands supported for propagation today.</p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={updateMutation.isPending || isLoading}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmRerenderOpen} onOpenChange={setConfirmRerenderOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Re-render propagation map?</DialogTitle>
            <DialogDescription>
              You changed the private map location. Queue a new coverage render now, or skip and render later from the
              node page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setConfirmRerenderOpen(false)}>
              Not now
            </Button>
            <Button
              type="button"
              onClick={() => {
                void recomputeMutation.mutateAsync().then(() => {
                  toast.success('Render queued');
                  setConfirmRerenderOpen(false);
                });
              }}
              disabled={recomputeMutation.isPending}
            >
              Yes, queue render
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
