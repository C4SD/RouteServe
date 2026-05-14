import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { IntegrationType, IntegrationConfig } from '@/types/integration';
import { toast } from 'sonner';

interface IntegrationConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationType: IntegrationType | null;
  integrationName?: string;
  existingConfig?: IntegrationConfig;
  onSave: (config: IntegrationConfig) => Promise<void>;
}

export function IntegrationConfigDialog({
  open,
  onOpenChange,
  integrationType,
  integrationName,
  existingConfig,
  onSave,
}: IntegrationConfigDialogProps) {
  const [config, setConfig] = useState<IntegrationConfig>(
    existingConfig || {
      apiUrl: '',
      apiKey: '',
      syncInterval: 60,
      enableWebhooks: false,
    }
  );
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(config);
      toast.success(`${integrationName} configured successfully`);
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTestResult('idle');
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setTestResult(Math.random() > 0.3 ? 'success' : 'error');
  };

  const renderConfigForm = () => {
    switch (integrationType) {
      case 'msupply':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiUrl">mSupply Server URL</Label>
              <Input
                id="apiUrl"
                placeholder="https://your-msupply-server.com"
                value={config.apiUrl || ''}
                onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                URL of your mSupply server instance
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="admin"
                value={config.username || ''}
                onChange={(e) => setConfig({ ...config, username: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">Password / API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="••••••••"
                value={config.apiKey || ''}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="storeId">Store ID</Label>
              <Input
                id="storeId"
                placeholder="main-warehouse"
                value={config.storeId || ''}
                onChange={(e) => setConfig({ ...config, storeId: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                Your mSupply store identifier
              </p>
            </div>
          </div>
        );

      case 'nhlmis':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiUrl">NHLMIS API URL</Label>
              <Input
                id="apiUrl"
                placeholder="https://nhlmis.ng/api"
                value={config.apiUrl || ''}
                onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="••••••••••••••••"
                value={config.apiKey || ''}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                Obtain from your NHLMIS admin portal
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="facilityId">Facility ID</Label>
              <Input
                id="facilityId"
                placeholder="FAC-12345"
                value={config.facilityId || ''}
                onChange={(e) => setConfig({ ...config, facilityId: e.target.value })}
              />
            </div>
          </div>
        );

      case 'traccar':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiUrl">Traccar Server URL</Label>
              <Input
                id="apiUrl"
                placeholder="https://traccar.example.com"
                value={config.apiUrl || ''}
                onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="admin"
                value={config.username || ''}
                onChange={(e) => setConfig({ ...config, username: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">Password</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="••••••••"
                value={config.apiKey || ''}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              />
            </div>
          </div>
        );

      case 'gt02_tracker':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="protocol">Protocol</Label>
              <Select
                value={config.protocol || 'tcp'}
                onValueChange={(value) =>
                  setConfig({ ...config, protocol: value as 'tcp' | 'udp' | 'http' })
                }
              >
                <SelectTrigger id="protocol">
                  <SelectValue placeholder="Select protocol" />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[10000]">
                  <SelectItem value="tcp">TCP (Recommended)</SelectItem>
                  <SelectItem value="udp">UDP</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                TCP is recommended for reliable data transmission
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                placeholder="5023"
                value={config.port || ''}
                onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 0 })}
              />
              <p className="text-sm text-muted-foreground">
                Default GT02 port is 5023
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deviceIds">Device IDs (comma-separated)</Label>
              <Input
                id="deviceIds"
                placeholder="GT02-001, GT02-002, GT02-003"
                value={config.deviceIds?.join(', ') || ''}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    deviceIds: e.target.value.split(',').map((id) => id.trim()).filter(Boolean),
                  })
                }
              />
              <p className="text-sm text-muted-foreground">
                Enter your GT02 device identifiers
              </p>
            </div>
          </div>
        );

      case 'fuel_monitoring':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sensorType">Sensor Type</Label>
              <Select
                value={config.sensorType || 'can_bus'}
                onValueChange={(value) =>
                  setConfig({
                    ...config,
                    sensorType: value as 'can_bus' | 'rs485' | 'obd' | 'analog',
                  })
                }
              >
                <SelectTrigger id="sensorType">
                  <SelectValue placeholder="Select sensor type" />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[10000]">
                  <SelectItem value="can_bus">CAN Bus</SelectItem>
                  <SelectItem value="rs485">RS-485</SelectItem>
                  <SelectItem value="obd">OBD-II</SelectItem>
                  <SelectItem value="analog">Analog Sensor</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Choose the type of fuel sensor installed in your vehicles
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiUrl">Gateway/Server URL (Optional)</Label>
              <Input
                id="apiUrl"
                placeholder="https://fuel-gateway.example.com"
                value={config.apiUrl || ''}
                onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                URL of your fuel monitoring gateway if applicable
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deviceIds">Device/Sensor IDs (comma-separated)</Label>
              <Input
                id="deviceIds"
                placeholder="FUEL-001, FUEL-002"
                value={config.deviceIds?.join(', ') || ''}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    deviceIds: e.target.value.split(',').map((id) => id.trim()).filter(Boolean),
                  })
                }
              />
              <p className="text-sm text-muted-foreground">
                Enter your fuel sensor identifiers
              </p>
            </div>
          </div>
        );

      case 'whatsapp':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiUrl">WhatsApp Business API URL</Label>
              <Input
                id="apiUrl"
                placeholder="https://graph.facebook.com/v18.0"
                value={config.apiUrl || ''}
                onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                Meta Graph API endpoint for WhatsApp Business
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">Access Token</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="EAALZC..."
                value={config.apiKey || ''}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                Permanent access token from Meta Developers
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number ID</Label>
              <Input
                id="phoneNumber"
                placeholder="123456789012345"
                value={config.username || ''}
                onChange={(e) => setConfig({ ...config, username: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                Your WhatsApp Business phone number ID
              </p>
            </div>
          </div>
        );

      case 'telegram':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">Bot Token</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                value={config.apiKey || ''}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                Get this from @BotFather on Telegram
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Bot Username</Label>
              <Input
                id="username"
                placeholder="your_bot"
                value={config.username || ''}
                onChange={(e) => setConfig({ ...config, username: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                Your Telegram bot username (without @)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhookUrl">Webhook URL (Optional)</Label>
              <Input
                id="webhookUrl"
                placeholder="https://your-app.com/webhooks/telegram"
                value={config.webhookUrl || ''}
                onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                URL to receive Telegram updates
              </p>
            </div>
          </div>
        );

      case 'trello':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="trello-api-key-123..."
                value={config.apiKey || ''}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                Get your API key from trello.com/app-key
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">API Token</Label>
              <Input
                id="username"
                type="password"
                placeholder="trello-token-abc..."
                value={config.username || ''}
                onChange={(e) => setConfig({ ...config, username: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                Generate token from trello.com/1/authorize
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="boardId">Board ID (Optional)</Label>
              <Input
                id="boardId"
                placeholder="1234567890abcdef"
                value={config.storeId || ''}
                onChange={(e) => setConfig({ ...config, storeId: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                Default board for delivery tracking
              </p>
            </div>
          </div>
        );

      case 'google_suite':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiUrl">Google Workspace Domain</Label>
              <Input
                id="apiUrl"
                placeholder="your-company.com"
                value={config.apiUrl || ''}
                onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                Your Google Workspace domain
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">Service Account Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="-----BEGIN PRIVATE KEY-----"
                value={config.apiKey || ''}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                JSON key file content for service account
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Service Account Email</Label>
              <Input
                id="username"
                placeholder="service-account@your-project.iam.gserviceaccount.com"
                value={config.username || ''}
                onChange={(e) => setConfig({ ...config, username: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                Email of the service account
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="facilityId">Default Calendar ID</Label>
              <Input
                id="facilityId"
                placeholder="calendar@group.calendar.google.com"
                value={config.facilityId || ''}
                onChange={(e) => setConfig({ ...config, facilityId: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                Default calendar for delivery scheduling
              </p>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center py-8 text-muted-foreground">
            Configuration form not available for this integration type.
          </div>
        );
    }
  };

  const canSave = () => {
    // Basic validation
    const noUrlRequired = ['gt02_tracker', 'fuel_monitoring', 'telegram'];
    const noApiKeyRequired = ['gt02_tracker', 'fuel_monitoring'];
    
    if (!config.apiUrl && !noUrlRequired.includes(integrationType || '')) {
      return false;
    }
    if (!config.apiKey && !noApiKeyRequired.includes(integrationType || '')) {
      return false;
    }
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {existingConfig ? 'Configure' : 'Add'} {integrationName}
          </DialogTitle>
          <DialogDescription>
            Enter your {integrationName} credentials and configuration details.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="connection" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="connection">Connection</TabsTrigger>
            <TabsTrigger value="sync">Sync Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="connection" className="space-y-4 mt-4">
            {renderConfigForm()}

            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={!canSave()}
              >
                Test Connection
              </Button>

              {testResult === 'success' && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm">Connection successful</span>
                </div>
              )}

              {testResult === 'error' && (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">Connection failed</span>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="sync" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="syncInterval">Sync Interval (minutes)</Label>
              <Input
                id="syncInterval"
                type="number"
                min="5"
                max="1440"
                value={config.syncInterval || 60}
                onChange={(e) =>
                  setConfig({ ...config, syncInterval: parseInt(e.target.value) })
                }
              />
              <p className="text-sm text-muted-foreground">
                How often to sync data (5-1440 minutes)
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Webhooks</Label>
                <p className="text-sm text-muted-foreground">
                  Receive real-time updates via webhooks
                </p>
              </div>
              <Switch
                checked={config.enableWebhooks || false}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, enableWebhooks: checked })
                }
              />
            </div>

            {config.enableWebhooks && (
              <div className="space-y-2">
                <Label htmlFor="webhookUrl">Webhook URL</Label>
                <Input
                  id="webhookUrl"
                  value={config.webhookUrl || ''}
                  onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
                  placeholder="https://your-app.com/webhooks/integration"
                />
                <p className="text-sm text-muted-foreground">
                  External system will send updates to this URL
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave() || isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {existingConfig ? 'Save Changes' : 'Add Integration'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
