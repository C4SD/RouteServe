/**
 * Driver Profile View - Employee Grid Inspired Layout
 * Full-featured driver profile with tabs and document management
 * Uses RouteServe design system branding
 */

import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Edit, Plus, FileText, Download, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Driver } from '@/types';

interface DriverProfileViewProps {
  driver: Driver;
  onBack?: () => void;
  onEdit?: () => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateString?: string): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Mock documents data - will be replaced with real data from useDriverDocuments hook
const mockDocuments = [
  {
    id: '1',
    title: 'Profile Photo',
    uploadDate: '2024-01-15',
    type: 'image',
    thumbnailUrl: null,
  },
  {
    id: '2',
    title: 'Driver License',
    uploadDate: '2024-01-15',
    type: 'document',
    thumbnailUrl: null,
  },
  {
    id: '3',
    title: 'Medical Certificate',
    uploadDate: '2024-02-01',
    type: 'document',
    thumbnailUrl: null,
  },
  {
    id: '4',
    title: 'Background Check',
    uploadDate: '2024-01-20',
    type: 'document',
    thumbnailUrl: null,
  },
];

export function DriverProfileView({ driver, onBack, onEdit }: DriverProfileViewProps) {
  const [activeTab, setActiveTab] = useState('info');

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header Section */}
      <div className="border-b border-border bg-card px-6 py-6 flex-shrink-0">
        <div className="flex items-center justify-between mb-6">
          {/* Back Button */}
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Grid
            </Button>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 ml-auto">
            <Select defaultValue="overview">
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overview">Overview</SelectItem>
                <SelectItem value="performance">Performance</SelectItem>
                <SelectItem value="history">History</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={onEdit} className="gap-2">
              <Edit className="h-4 w-4" />
              Edit
            </Button>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Create
            </Button>
          </div>
        </div>

        {/* Driver Info Header */}
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <Avatar className="h-24 w-24 border-4 border-background shadow-lg flex-shrink-0">
            <AvatarImage src={driver.profilePhotoUrl} />
            <AvatarFallback className="bg-primary/10 text-primary text-2xl font-semibold">
              {getInitials(driver.name)}
            </AvatarFallback>
          </Avatar>

          {/* Driver Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                {driver.name}
              </h1>
              <Badge variant="secondary" className="text-xs">
                {driver.position || 'Driver'}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-x-8 gap-y-2 mt-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Date of Birth</p>
                <p className="text-sm text-foreground font-medium">
                  {formatDate(driver.dateOfBirth)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Work Phone</p>
                <p className="text-sm text-foreground font-medium">{driver.phone}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Email</p>
                <p className="text-sm text-foreground font-medium">
                  {driver.email || (
                    <span className="text-muted-foreground italic">Not provided</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b border-border bg-card px-6">
          <TabsList className="border-b-0 bg-transparent h-auto p-0 w-full justify-start rounded-none">
            <TabsTrigger
              value="info"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-4 py-3"
            >
              Employee Information
            </TabsTrigger>
            <TabsTrigger
              value="phones"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-4 py-3"
            >
              Phone Numbers
            </TabsTrigger>
            <TabsTrigger
              value="payroll"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-4 py-3"
            >
              Payroll Data
            </TabsTrigger>
            <TabsTrigger
              value="pay"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-4 py-3"
            >
              Pay Method
            </TabsTrigger>
            <TabsTrigger
              value="notes"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-4 py-3"
            >
              Notes
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          <TabsContent value="info" className="m-0 p-6">
            {/* Employee Information Grid */}
            <div className="grid grid-cols-3 gap-8 mb-8">
              {/* Left Column */}
              <div className="space-y-4">
                <InfoField label="Employer" value={driver.employer || 'RouteServe Logistics'} />
                <InfoField label="Group Name" value={driver.groupName || 'Full Time'} />
                <InfoField label="Full Name" value={driver.name} />
                <InfoField
                  label="Default Position"
                  value={driver.position || 'Delivery Driver'}
                />
                <InfoField label="First Name" value={driver.name.split(' ')[0]} />
                <InfoField label="Middle Name" value={driver.middleName || 'N/A'} />
                <InfoField
                  label="Last Name"
                  value={driver.name.split(' ').slice(1).join(' ')}
                />
              </div>

              {/* Middle Column */}
              <div className="space-y-4">
                <InfoField
                  label="Preferred Services"
                  value={driver.preferredServices || 'Local Delivery'}
                />
                <InfoField
                  label="License Type"
                  value={driver.licenseType === 'commercial' ? 'Commercial (CDL)' : 'Standard'}
                />
                <InfoField label="License Number" value={driver.licenseNumber || 'N/A'} />
                <InfoField label="License Expiry" value={formatDate(driver.licenseExpiry)} />
                <InfoField
                  label="Employment Type"
                  value={driver.employmentType || 'Full-time'}
                />
                <InfoField label="Start Date" value={formatDate(driver.startDate)} />
                <InfoField
                  label="Shift Hours"
                  value={`${driver.shiftStart} - ${driver.shiftEnd}`}
                />
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <InfoField label="Federal ID Number" value={driver.federalId || 'N/A'} />
                <InfoField label="Address 1" value={driver.addressLine1 || 'N/A'} />
                <InfoField label="Address 2" value={driver.addressLine2 || 'N/A'} />
                <InfoField label="City" value={driver.city || 'N/A'} />
                <InfoField label="State/Province" value={driver.stateProvince || 'N/A'} />
                <InfoField label="Country Name" value={driver.country || 'N/A'} />
                <InfoField label="Zip/Postal Code" value={driver.postalCode || 'N/A'} />
              </div>
            </div>

            {/* Attachments Section */}
            <div className="mt-8 pt-8 border-t border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Attachments
                </h3>
                <Button variant="outline" size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Upload Document
                </Button>
              </div>

              <div className="grid grid-cols-4 gap-4">
                {mockDocuments.map((doc) => (
                  <Card
                    key={doc.id}
                    className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                  >
                    <div className="aspect-square bg-muted/30 flex items-center justify-center relative">
                      {doc.thumbnailUrl ? (
                        <img
                          src={doc.thumbnailUrl}
                          alt={doc.title}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <FileText className="h-12 w-12 text-muted-foreground" />
                      )}

                      {/* Hover Actions */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-8 w-8"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="destructive"
                          className="h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-medium text-foreground truncate">
                        {doc.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Created {formatDate(doc.uploadDate)}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="phones" className="m-0 p-6">
            <div className="space-y-4">
              <InfoField label="Primary Phone" value={driver.phone} />
              <InfoField
                label="Emergency Contact"
                value={driver.emergencyContactName || 'N/A'}
              />
              <InfoField
                label="Emergency Phone"
                value={driver.emergencyContactPhone || 'N/A'}
              />
            </div>
          </TabsContent>

          <TabsContent value="payroll" className="m-0 p-6">
            <div className="text-center py-12 text-muted-foreground">
              Payroll data coming soon
            </div>
          </TabsContent>

          <TabsContent value="pay" className="m-0 p-6">
            <div className="text-center py-12 text-muted-foreground">
              Payment method configuration coming soon
            </div>
          </TabsContent>

          <TabsContent value="notes" className="m-0 p-6">
            <div className="text-center py-12 text-muted-foreground">
              Driver notes coming soon
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// Helper component for info fields
function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1.5 block">{label}</Label>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}
