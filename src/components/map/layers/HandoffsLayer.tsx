import { Polyline, Marker, Popup } from 'react-leaflet';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MapIcons } from '@/lib/mapIcons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HandshakeIcon, Clock, MapPin } from 'lucide-react';

interface HandoffsLayerProps {
  selectedHandoffId?: string | null;
  onHandoffClick?: (handoffId: string) => void;
}

export function HandoffsLayer({
  selectedHandoffId,
  onHandoffClick,
}: HandoffsLayerProps) {
  const { data: handoffs = [] } = useQuery({
    queryKey: ['handoffs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('handoffs')
        .select(`
          *,
          from_vehicle:vehicles!from_vehicle_id(plate_number, current_lat, current_lng),
          to_vehicle:vehicles!to_vehicle_id(plate_number, current_lat, current_lng)
        `)
        .in('status', ['planned', 'pending'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });

  return (
    <>
      {handoffs.map((handoff) => {
        const fromVehicle = handoff.from_vehicle as any;
        const toVehicle = handoff.to_vehicle as any;
        
        // Only render if we have vehicle locations
        if (
          !fromVehicle?.current_lat || 
          !fromVehicle?.current_lng ||
          !handoff.location_lat || 
          !handoff.location_lng
        ) {
          return null;
        }

        const fromPoint: [number, number] = [
          fromVehicle.current_lat,
          fromVehicle.current_lng,
        ];
        const handoffPoint: [number, number] = [
          handoff.location_lat,
          handoff.location_lng,
        ];

        // Dotted line from origin vehicle to handoff point
        const pathColor = handoff.status === 'completed' 
          ? 'hsl(142 76% 36%)'  // success
          : handoff.status === 'pending'
          ? 'hsl(38 92% 50%)'   // warning
          : 'hsl(215 20% 65%)'; // muted

        return (
          <div key={handoff.id}>
            {/* Dotted trail line */}
            <Polyline
              positions={[fromPoint, handoffPoint]}
              pathOptions={{
                color: pathColor,
                weight: 3,
                opacity: 0.7,
                dashArray: '10, 10',
                lineCap: 'round',
              }}
            />

            {/* Handoff point marker */}
            <Marker
              position={handoffPoint}
              icon={MapIcons.handoffPoint(handoff.status as 'planned' | 'pending' | 'completed' | 'cancelled')}
              eventHandlers={{
                click: () => onHandoffClick?.(handoff.id),
              }}
            >
              <Popup>
                <div className="p-2 min-w-[250px]">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <HandshakeIcon className="w-4 h-4 text-secondary-foreground" />
                    Handoff Point
                  </h3>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge
                        variant={
                          handoff.status === 'completed'
                            ? 'default'
                            : handoff.status === 'pending'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {handoff.status}
                      </Badge>
                    </div>

                    <div>
                      <span className="text-muted-foreground">From:</span>{' '}
                      <span className="font-medium">
                        {fromVehicle.plate_number}
                      </span>
                    </div>

                    {toVehicle && (
                      <div>
                        <span className="text-muted-foreground">To:</span>{' '}
                        <span className="font-medium">
                          {toVehicle.plate_number}
                        </span>
                      </div>
                    )}

                    {handoff.scheduled_time && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span className="text-xs">
                          {new Date(handoff.scheduled_time).toLocaleString()}
                        </span>
                      </div>
                    )}

                    <div className="flex items-start gap-1 text-muted-foreground">
                      <MapPin className="w-3 h-3 mt-0.5" />
                      <span className="text-xs">
                        {handoff.location_lat.toFixed(4)},{' '}
                        {handoff.location_lng.toFixed(4)}
                      </span>
                    </div>

                    {handoff.notes && (
                      <div className="text-xs text-muted-foreground border-t pt-2 mt-2">
                        {handoff.notes}
                      </div>
                    )}

                    <Button
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => onHandoffClick?.(handoff.id)}
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              </Popup>
            </Marker>
          </div>
        );
      })}
    </>
  );
}
