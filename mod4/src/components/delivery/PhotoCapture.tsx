// MOD4 Photo Capture
// Camera/gallery photo capture for delivery proof

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Image as ImageIcon, X, Check, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PhotoCaptureProps {
  onPhotoChange: (dataUrl: string | null) => void;
  className?: string;
}

export function PhotoCapture({ onPhotoChange, className }: PhotoCaptureProps) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      setIsCapturing(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera access denied:', err);
      setIsCapturing(false);
      // Fallback to file picker
      fileInputRef.current?.click();
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setPhoto(dataUrl);
      onPhotoChange(dataUrl);
    }
    
    stopCamera();
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setPhoto(dataUrl);
      onPhotoChange(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setPhoto(null);
    onPhotoChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const retakePhoto = () => {
    removePhoto();
    startCamera();
  };

  return (
    <div className={cn("space-y-3", className)}>
      <label htmlFor="delivery-photo" className="text-sm font-medium text-foreground">Delivery Photo</label>

      <input
        id="delivery-photo"
        name="delivery-photo"
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      <AnimatePresence mode="wait">
        {isCapturing ? (
          <motion.div
            key="camera"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative rounded-xl overflow-hidden bg-black aspect-video"
          >
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            
            {/* Camera controls */}
            <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-4">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="w-12 h-12 rounded-full border-white/30 bg-black/50 text-white hover:bg-black/70"
                onClick={stopCamera}
              >
                <X className="w-5 h-5" />
              </Button>
              
              <Button
                type="button"
                size="icon"
                className="w-16 h-16 rounded-full bg-white text-black hover:bg-white/90 shadow-xl"
                onClick={capturePhoto}
              >
                <Camera className="w-6 h-6" />
              </Button>
              
              <div className="w-12 h-12" /> {/* Spacer for symmetry */}
            </div>
          </motion.div>
        ) : photo ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative rounded-xl overflow-hidden aspect-video bg-secondary"
          >
            <img
              src={photo}
              alt="Delivery proof"
              className="w-full h-full object-cover"
            />
            
            {/* Photo controls overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="bg-black/50 border-white/30 text-white hover:bg-black/70"
                onClick={retakePhoto}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Retake
              </Button>
              
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="bg-black/50 border-white/30 text-white hover:bg-black/70"
                onClick={removePhoto}
              >
                <X className="w-4 h-4 mr-2" />
                Remove
              </Button>
            </div>
            
            {/* Success badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-full bg-success text-success-foreground text-xs font-semibold"
            >
              <Check className="w-3 h-3" />
              Captured
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-2 gap-3"
          >
            <Button
              type="button"
              variant="outline"
              className="h-24 flex-col gap-2 rounded-xl border-dashed border-2 hover:border-primary/50 hover:bg-primary/5"
              onClick={startCamera}
            >
              <Camera className="w-6 h-6 text-primary" />
              <span className="text-sm font-medium">Take Photo</span>
            </Button>
            
            <Button
              type="button"
              variant="outline"
              className="h-24 flex-col gap-2 rounded-xl border-dashed border-2 hover:border-primary/50 hover:bg-primary/5"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="w-6 h-6 text-primary" />
              <span className="text-sm font-medium">Gallery</span>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
