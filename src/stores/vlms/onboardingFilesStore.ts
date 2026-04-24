/**
 * Onboarding Files Store
 * Temporary store for staging documents and photos during vehicle onboarding.
 * Files are uploaded to Supabase Storage after the vehicle record is created.
 */

import { create } from 'zustand';

export interface StagedDocument {
  file: File;
  type: string;
}

export interface StagedPhoto {
  file: File;
  caption: string;
}

interface OnboardingFilesState {
  stagedDocuments: StagedDocument[];
  stagedPhotos: StagedPhoto[];
  addDocuments: (files: File[], type?: string) => void;
  addPhotos: (files: File[], caption?: string) => void;
  updateDocumentType: (index: number, type: string) => void;
  updatePhotoCaption: (index: number, caption: string) => void;
  removeDocument: (index: number) => void;
  removePhoto: (index: number) => void;
  reset: () => void;
}

export const useOnboardingFilesStore = create<OnboardingFilesState>((set) => ({
  stagedDocuments: [],
  stagedPhotos: [],

  addDocuments: (files, type = 'registration') =>
    set((state) => ({
      stagedDocuments: [...state.stagedDocuments, ...files.map((file) => ({ file, type }))],
    })),

  addPhotos: (files, caption = '') =>
    set((state) => ({
      stagedPhotos: [...state.stagedPhotos, ...files.map((file) => ({ file, caption }))],
    })),

  updateDocumentType: (index, type) =>
    set((state) => ({
      stagedDocuments: state.stagedDocuments.map((d, i) => (i === index ? { ...d, type } : d)),
    })),

  updatePhotoCaption: (index, caption) =>
    set((state) => ({
      stagedPhotos: state.stagedPhotos.map((p, i) => (i === index ? { ...p, caption } : p)),
    })),

  removeDocument: (index) =>
    set((state) => ({
      stagedDocuments: state.stagedDocuments.filter((_, i) => i !== index),
    })),

  removePhoto: (index) =>
    set((state) => ({
      stagedPhotos: state.stagedPhotos.filter((_, i) => i !== index),
    })),

  reset: () => set({ stagedDocuments: [], stagedPhotos: [] }),
}));
