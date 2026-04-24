import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, Pencil, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Facility } from '@/types';
import { detectCoordinateIssues, CoordinateIssue } from '@/lib/geo-bounds';
import { useUpdateFacility } from '@/hooks/useFacilities';
import { toast } from 'sonner';

interface FacilityWithIssues {
  facility: Facility;
  issues: CoordinateIssue[];
}

interface CoordinateAuditPanelProps {
  facilities: Facility[];
  onEditFacility: (facility: Facility) => void;
}

export function CoordinateAuditPanel({ facilities, onEditFacility }: CoordinateAuditPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const updateFacility = useUpdateFacility();

  const flaggedFacilities = useMemo<FacilityWithIssues[]>(() => {
    return facilities
      .map((f) => ({
        facility: f,
        issues: detectCoordinateIssues(f.lat, f.lng, f.state),
      }))
      .filter((item) => item.issues.length > 0);
  }, [facilities]);

  if (dismissed || flaggedFacilities.length === 0) return null;

  const swappedCount = flaggedFacilities.filter((item) =>
    item.issues.some((i) => i.type === 'likely_swapped')
  ).length;

  const outsideNigeriaCount = flaggedFacilities.filter((item) =>
    item.issues.some((i) => i.type === 'outside_nigeria')
  ).length;

  function handleSwap(facility: Facility) {
    updateFacility.mutate(
      { id: facility.id, updates: { lat: facility.lng, lng: facility.lat } },
      {
        onSuccess: () => toast.success(`Swapped coordinates for ${facility.name}`),
      }
    );
  }

  function handleBulkSwap() {
    const swapped = flaggedFacilities.filter((item) =>
      item.issues.some((i) => i.type === 'likely_swapped')
    );
    swapped.forEach(({ facility }) => {
      updateFacility.mutate({ id: facility.id, updates: { lat: facility.lng, lng: facility.lat } });
    });
    toast.success(`Swapping coordinates for ${swapped.length} facilities...`);
  }

  return (
    <div className="mx-6 mb-2 rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-600">
      {/* Summary bar */}
      <div className="flex items-center gap-3 px-4 py-3">
        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
        <div className="flex-1 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
            {flaggedFacilities.length} {flaggedFacilities.length === 1 ? 'facility' : 'facilities'} with coordinate issues
          </span>
          {outsideNigeriaCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {outsideNigeriaCount} outside Nigeria
            </Badge>
          )}
          {swappedCount > 0 && (
            <Badge className="text-xs bg-yellow-200 text-yellow-900 border-yellow-300 hover:bg-yellow-200">
              {swappedCount} likely swapped
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {swappedCount > 1 && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs border-yellow-400 text-yellow-800 hover:bg-yellow-100"
              onClick={handleBulkSwap}
              disabled={updateFacility.isPending}
            >
              <ArrowLeftRight className="h-3 w-3 mr-1" />
              Fix all swapped
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-yellow-700 hover:bg-yellow-100"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-yellow-600 hover:bg-yellow-100"
            onClick={() => setDismissed(true)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Expanded list */}
      {expanded && (
        <div className="border-t border-yellow-200 dark:border-yellow-700 divide-y divide-yellow-100 dark:divide-yellow-800 max-h-64 overflow-y-auto">
          {flaggedFacilities.map(({ facility, issues }) => (
            <div key={facility.id} className="flex items-start gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200 truncate">
                  {facility.name}
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">
                  lat: {facility.lat?.toFixed(5)}, lng: {facility.lng?.toFixed(5)}
                  {facility.lga && ` · ${facility.lga}`}
                </p>
                {issues.map((issue, i) => (
                  <p key={i} className="text-xs text-yellow-800 dark:text-yellow-300 mt-0.5">
                    {issue.type === 'likely_swapped' ? '↕' : '✕'} {issue.message}
                  </p>
                ))}
              </div>
              <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                {issues.some((i) => i.type === 'likely_swapped') && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs px-2 border-yellow-400 text-yellow-800 hover:bg-yellow-100"
                    onClick={() => handleSwap(facility)}
                    disabled={updateFacility.isPending}
                    title={`Swap to lat=${facility.lng?.toFixed(5)}, lng=${facility.lat?.toFixed(5)}`}
                  >
                    <ArrowLeftRight className="h-3 w-3 mr-1" />
                    Swap
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-yellow-700 hover:bg-yellow-100"
                  onClick={() => onEditFacility(facility)}
                  title="Edit facility"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
