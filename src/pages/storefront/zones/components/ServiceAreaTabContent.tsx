import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ServiceArea } from '@/types/service-areas';
import { ServiceAreaStats } from './service-areas/ServiceAreaStats';
import { ServiceAreaTable } from './service-areas/ServiceAreaTable';
import { CreateServiceAreaWizard } from './service-areas/CreateServiceAreaWizard';
import { ServiceAreaDetailDialog } from './service-areas/ServiceAreaDetailDialog';
import { EditServiceAreaDialog } from './service-areas/EditServiceAreaDialog';
import { ServicePolicyTabPage } from './service-areas/ServicePolicyTabPage';

type SubTab = 'service-areas' | 'service-policy';

export function ServiceAreaTabContent() {
  const [subTab, setSubTab] = useState<SubTab>('service-areas');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [detailServiceArea, setDetailServiceArea] = useState<ServiceArea | null>(null);
  const [editServiceArea, setEditServiceArea] = useState<ServiceArea | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Service Areas</h2>
        <p className="text-muted-foreground mt-1">
          Define facility-to-warehouse access logic within zones
        </p>
      </div>

      <Tabs value={subTab} onValueChange={v => setSubTab(v as SubTab)} className="w-full">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="service-areas">Service Areas</TabsTrigger>
            <TabsTrigger value="service-policy">Service Policy</TabsTrigger>
          </TabsList>

          {subTab === 'service-areas' && (
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Service Area
            </Button>
          )}
        </div>

        <TabsContent value="service-areas" className="space-y-6 mt-4">
          <ServiceAreaStats />
          <ServiceAreaTable
            onViewDetail={setDetailServiceArea}
            onEdit={setEditServiceArea}
          />
        </TabsContent>

        <TabsContent value="service-policy" className="mt-4">
          <ServicePolicyTabPage />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CreateServiceAreaWizard
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />

      {detailServiceArea && (
        <ServiceAreaDetailDialog
          serviceArea={detailServiceArea}
          open={!!detailServiceArea}
          onOpenChange={(open) => !open && setDetailServiceArea(null)}
          onEdit={(sa) => {
            setDetailServiceArea(null);
            setEditServiceArea(sa);
          }}
        />
      )}

      {editServiceArea && (
        <EditServiceAreaDialog
          serviceArea={editServiceArea}
          open={!!editServiceArea}
          onOpenChange={(open) => !open && setEditServiceArea(null)}
        />
      )}
    </div>
  );
}
