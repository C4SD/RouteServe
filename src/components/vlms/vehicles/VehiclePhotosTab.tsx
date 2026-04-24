import { useRef, useState } from 'react';
import { useUploadVehiclePhoto, useRemoveVehiclePhoto } from '@/hooks/vlms/useVehicles';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
} from '@/components/ui/dialog';
import { Image as ImageIcon, Upload, Trash2, Loader2, ZoomIn } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

interface Photo {
  url: string;
  caption?: string;
  uploaded_at?: string;
}

interface VehiclePhotosTabProps {
  vehicleId: string;
  photos: Photo[];
}

export function VehiclePhotosTab({ vehicleId, photos }: VehiclePhotosTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState('');
  const [pendingDeleteUrl, setPendingDeleteUrl] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { mutate: uploadPhoto, isPending: uploading } = useUploadVehiclePhoto();
  const { mutate: removePhoto, isPending: removing } = useRemoveVehiclePhoto();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    uploadPhoto({ vehicleId, file, caption: caption || undefined });

    setCaption('');
    e.target.value = '';
  };

  const handleDelete = () => {
    if (!pendingDeleteUrl) return;
    removePhoto({ vehicleId, photoUrl: pendingDeleteUrl });
    setPendingDeleteUrl(null);
  };

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium">Caption (optional)</label>
              <Input
                placeholder="e.g. Front view after service"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
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
              {uploading ? 'Uploading…' : 'Upload Photo'}
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            PNG, JPG, or WebP images accepted
          </p>
        </CardContent>
      </Card>

      {/* Photo grid */}
      {photos.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {photos.map((photo, idx) => (
            <div key={idx} className="group relative space-y-1.5">
              <div className="relative overflow-hidden rounded-lg border bg-muted aspect-video">
                <img
                  src={photo.url}
                  alt={photo.caption || `Vehicle photo ${idx + 1}`}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setLightboxUrl(photo.url)}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setPendingDeleteUrl(photo.url)}
                    disabled={removing}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {(photo.caption || photo.uploaded_at) && (
                <div className="px-0.5">
                  {photo.caption && (
                    <p className="text-sm font-medium truncate">{photo.caption}</p>
                  )}
                  {photo.uploaded_at && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(photo.uploaded_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={ImageIcon}
          title="No photos uploaded"
          description="Add photos of the vehicle — exterior, interior, or damage documentation."
          variant="dashed"
        />
      )}

      {/* Lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={(o) => !o && setLightboxUrl(null)}>
        <DialogContent className="max-w-4xl p-2 bg-black border-0">
          <DialogDescription className="sr-only">Vehicle photo full size view</DialogDescription>
          {lightboxUrl && (
            <img
              src={lightboxUrl}
              alt="Vehicle photo full size"
              className="w-full h-auto max-h-[80vh] object-contain rounded"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!pendingDeleteUrl} onOpenChange={(o) => !o && setPendingDeleteUrl(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove photo?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the photo from storage. This action cannot be undone.
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
