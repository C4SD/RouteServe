import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bot } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ZoneTabContent } from './components/ZoneTabContent';
import { ServiceAreaTabContent } from './components/ServiceAreaTabContent';
import { RouteManagementTabContent } from './components/RouteManagementTabContent';
import { FacilityTableView } from './components/FacilityTableView';
import { OperationsCopilotWizard } from './components/copilot/OperationsCopilotWizard';

const VALID_TABS = ['zones', 'service-areas', 'routes', 'facility-audit'] as const;
type TabValue = (typeof VALID_TABS)[number];

export default function ZonesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [copilotOpen, setCopilotOpen] = useState(false);
  const tabParam = searchParams.get('tab') as TabValue | null;
  const activeTab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'zones';

  const handleTabChange = (value: string) => {
    if (value === 'zones') {
      searchParams.delete('tab');
    } else {
      searchParams.set('tab', value);
    }
    setSearchParams(searchParams, { replace: true });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Zones & Logistics</h1>
          <p className="text-muted-foreground mt-1">
            Manage zones, service areas, and delivery routes
          </p>
        </div>
        <Button onClick={() => setCopilotOpen(true)} className="gap-2 shrink-0">
          <Bot className="h-4 w-4" />
          Operations Copilot
        </Button>
      </div>

      <OperationsCopilotWizard open={copilotOpen} onOpenChange={setCopilotOpen} />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="zones">Zones</TabsTrigger>
          <TabsTrigger value="service-areas">Service Areas</TabsTrigger>
          <TabsTrigger value="routes">Route Management</TabsTrigger>
          <TabsTrigger value="facility-audit">Facility Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="zones" className="mt-6">
          <ZoneTabContent />
        </TabsContent>
        <TabsContent value="service-areas" className="mt-6">
          <ServiceAreaTabContent />
        </TabsContent>
        <TabsContent value="routes" className="mt-6">
          <RouteManagementTabContent />
        </TabsContent>
        <TabsContent value="facility-audit" className="mt-6">
          <FacilityTableView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
