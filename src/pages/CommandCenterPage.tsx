import Layout from '@/components/layout/Layout';
import { useFacilities } from '@/hooks/useFacilities';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useDeliveryBatches } from '@/hooks/useDeliveryBatches';
import { useBatchRouteGeometries } from '@/hooks/useBatchRouteGeometries';
import CommandCenter from '@/pages/CommandCenter';

export default function CommandCenterPage() {
  const { data: facilitiesData } = useFacilities();
  const facilities = facilitiesData?.facilities || [];
  const { data: warehousesData } = useWarehouses();
  const warehouses = warehousesData?.warehouses || [];
  const { data: rawBatches = [] } = useDeliveryBatches();
  const batches = useBatchRouteGeometries(rawBatches, warehouses);
  
  return (
    <CommandCenter 
      facilities={facilities}
      warehouses={warehouses}
      batches={batches}
    />
  );
}
