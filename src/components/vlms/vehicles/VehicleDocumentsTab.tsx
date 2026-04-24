import { useRef, useState } from 'react';
import { useUploadVehicleDocument, useRemoveVehicleDocument } from '@/hooks/vlms/useVehicles';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FileText, Upload, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

const DOCUMENT_TYPES = [
  { value: 'registration', label: 'Registration' },
  { value: 'insurance', label: 'Insurance Certificate' },
  { value: 'roadworthiness', label: 'Road Worthiness' },
  { value: 'purchase', label: 'Purchase / Bill of Sale' },
  { value: 'service_record', label: 'Service Record' },
  { value: 'warranty', label: 'Warranty' },
  { value: 'inspection_report', label: 'Inspection Report' },
  { value: 'customs', label: 'Customs / Import' },
  { value: 'other', label: 'Other' },
];

const DOC_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  DOCUMENT_TYPES.map((t) => [t.value, t.label])
);

interface Document {
  url: string;
  type: string;
  name: string;
  uploaded_at: string;
  size?: number;
}

interface VehicleDocumentsTabProps {
  vehicleId: string;
  documents: Document[];
}

function formatBytes(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function VehicleDocumentsTab({ vehicleId, documents }: VehicleDocumentsTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState('registration');
  const [pendingDeleteUrl, setPendingDeleteUrl] = useState<string | null>(null);

  const { mutate: uploadDocument, isPending: uploading } = useUploadVehicleDocument();
  const { mutate: removeDocument, isPending: removing } = useRemoveVehicleDocument();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    uploadDocument({ vehicleId, file, type: docType });

    // Reset input so the same file can be re-uploaded after removal
    e.target.value = '';
  };

  const handleDelete = () => {
    if (!pendingDeleteUrl) return;
    removeDocument({ vehicleId, documentUrl: pendingDeleteUrl });
    setPendingDeleteUrl(null);
  };

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium">Document Type</label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="shrink-0"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {uploading ? 'Uploading…' : 'Upload Document'}
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            PDF, Word, Excel, or image files accepted
          </p>
        </CardContent>
      </Card>

      {/* Document list */}
      {documents.length > 0 ? (
        <div className="space-y-2">
          {documents.map((doc, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{doc.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className="text-xs">
                      {DOC_TYPE_LABELS[doc.type] || doc.type}
                    </Badge>
                    {doc.size && (
                      <span className="text-xs text-muted-foreground">{formatBytes(doc.size)}</span>
                    )}
                    {doc.uploaded_at && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(doc.uploaded_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0 ml-3">
                <Button variant="ghost" size="sm" asChild>
                  <a href={doc.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPendingDeleteUrl(doc.url)}
                  disabled={removing}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title="No documents uploaded"
          description="Upload registration, insurance, and other vehicle documents."
          variant="dashed"
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!pendingDeleteUrl} onOpenChange={(o) => !o && setPendingDeleteUrl(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the file from storage. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
