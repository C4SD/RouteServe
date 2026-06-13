// MOD4 Evidence Capture Component
// Captures multiple photos as evidence for support requests

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Image, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface EvidenceCaptureProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  maxPhotos?: number;
}

export function EvidenceCapture({ 
  photos, 
  onPhotosChange, 
  maxPhotos = 4 
}: EvidenceCaptureProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      onPhotosChange([...photos, dataUrl]);
      setIsCapturing(false);
    };
    reader.readAsDataURL(file);
    
    // Reset input
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    onPhotosChange(photos.filter((_, i) => i !== index));
  };

  const canAddMore = photos.length < maxPhotos;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">
          Evidence Photos
        </span>
        <span className="text-xs text-muted-foreground">
          {photos.length}/{maxPhotos}
        </span>
      </div>

      {/* Photo Grid */}
      <div className="grid grid-cols-2 gap-3">
        <AnimatePresence mode="popLayout">
          {photos.map((photo, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="relative aspect-square rounded-xl overflow-hidden border-2 border-border"
            >
              <img 
                src={photo} 
                alt={`Evidence ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => removePhoto(index)}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-destructive/90 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-destructive-foreground" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Add Photo Button */}
        {canAddMore && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setIsCapturing(true)}
            className={cn(
              "aspect-square rounded-xl border-2 border-dashed border-muted-foreground/30",
              "flex flex-col items-center justify-center gap-2",
              "bg-muted/30 hover:bg-muted/50 transition-colors",
              "active:scale-[0.98] touch-target"
            )}
          >
            <Plus className="w-8 h-8 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Add Photo</span>
          </motion.button>
        )}
      </div>

      {/* Hidden Inputs */}
      <input
        ref={cameraInputRef}
        name="evidence-camera"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        name="evidence-file"
        type="file"
        accept="image/*"
        onChange={handleCapture}
        className="hidden"
      />

      {/* Capture Options Modal */}
      <AnimatePresence>
        {isCapturing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm"
            onClick={() => setIsCapturing(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-card border-t border-border rounded-t-2xl p-6 space-y-4"
            >
              <h3 className="text-lg font-semibold text-center">Add Evidence Photo</h3>
              
              <Button
                onClick={() => cameraInputRef.current?.click()}
                className="w-full h-14 gap-3"
              >
                <Camera className="w-5 h-5" />
                Take Photo
              </Button>
              
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-14 gap-3"
              >
                <Image className="w-5 h-5" />
                Choose from Gallery
              </Button>

              <Button
                variant="ghost"
                onClick={() => setIsCapturing(false)}
                className="w-full"
              >
                Cancel
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
