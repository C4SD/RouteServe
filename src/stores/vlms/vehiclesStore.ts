/**
 * VLMS Vehicles Zustand Store
 * Manages vehicle state and operations
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Vehicle, VehicleWithRelations, VehicleFormData, VehicleFilters } from '@/types/vlms';
import { getVehiclesTableName } from '@/lib/featureFlags';

type SafeArray<T> = (value: unknown) => T[];
const safeArray: SafeArray<any> = (value) => Array.isArray(value) ? value : [];

const normalizeStatus = (status?: string): 'available' | 'in-use' | 'maintenance' | 'out_of_service' | 'disposed' => {
  if (!status) return 'available';
  return status === 'in_use' ? 'in-use' : status as any;
};

export type ViewMode = 'list' | 'card' | 'kanban';

export type FuelType = 'diesel' | 'petrol' | 'electric' | 'gasoline' | 'hybrid' | 'cng' | 'lpg';

interface VehiclesState {
  // State
  vehicles: VehicleWithRelations[];
  selectedVehicle: VehicleWithRelations | null;
  filters: VehicleFilters;
  isLoading: boolean;
  error: string | null;
  viewMode: ViewMode;
  sidebarCollapsed: boolean;

  // Actions
  setVehicles: (vehicles: VehicleWithRelations[]) => void;
  setSelectedVehicle: (vehicle: VehicleWithRelations | null) => void;
  setFilters: (filters: Partial<VehicleFilters>) => void;
  clearFilters: () => void;
  setViewMode: (mode: ViewMode) => void;
  toggleSidebar: () => void;

  // Async Actions
  fetchVehicles: () => Promise<void>;
  fetchVehicleById: (id: string) => Promise<void>;
  createVehicle: (data: VehicleFormData) => Promise<Vehicle>;
  updateVehicle: (id: string, data: Partial<VehicleFormData>) => Promise<void>;
  deleteVehicle: (id: string) => Promise<void>;
  uploadDocument: (vehicleId: string, file: File, type: string) => Promise<void>;
  uploadPhoto: (vehicleId: string, file: File, caption?: string) => Promise<void>;
  removeDocument: (vehicleId: string, documentUrl: string) => Promise<void>;
  removePhoto: (vehicleId: string, photoUrl: string) => Promise<void>;
}

export const useVehiclesStore = create<VehiclesState>()(
  devtools(
    (set, get) => ({
      // Initial State
      vehicles: [],
      selectedVehicle: null,
      filters: {},
      isLoading: false,
      error: null,
      viewMode: (typeof window !== 'undefined' && localStorage.getItem('vehicleViewMode') as ViewMode) || 'kanban',
      sidebarCollapsed: (typeof window !== 'undefined' && localStorage.getItem('vehicleSidebarCollapsed') === 'true') || false,

      // Setters
      setVehicles: (vehicles) => set({ vehicles }),

      setSelectedVehicle: (vehicle) => set({ selectedVehicle: vehicle }),

      setFilters: (newFilters) =>
        set((state) => ({
          filters: { ...state.filters, ...newFilters },
        })),

      clearFilters: () => set({ filters: {} }),

      setViewMode: (mode) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('vehicleViewMode', mode);
        }
        set({ viewMode: mode });
      },

      toggleSidebar: () =>
        set((state) => {
          const newCollapsed = !state.sidebarCollapsed;
          if (typeof window !== 'undefined') {
            localStorage.setItem('vehicleSidebarCollapsed', String(newCollapsed));
          }
          return { sidebarCollapsed: newCollapsed };
        }),

      // Fetch Vehicles with Filters
      fetchVehicles: async () => {
        set({ isLoading: true, error: null });
        try {
          const { filters } = get();
          const tableName = getVehiclesTableName();
          const workspaceId = localStorage.getItem('biko_active_workspace_id');
          if (!workspaceId) throw new Error('No active workspace selected');

          // Type assertion for the table name
          // Cast to any to bypass Supabase's strict table name types
          const table = tableName as any;

          // Build query with proper typing
          // Note: Removed FK joins as the constraint names don't exist in the database schema
          // Related data can be fetched separately if needed (see fetchVehicleById for pattern)
          let query = supabase
            .from(table)
            .select('*', { count: 'exact' })
            .eq('workspace_id', workspaceId)
            .order('created_at', { ascending: false }) as any;

          // Apply filters
          if (filters.search) {
            query = query.or(
              `make.ilike.%${filters.search}%,model.ilike.%${filters.search}%,license_plate.ilike.%${filters.search}%,vehicle_id.ilike.%${filters.search}%`
            ) as any; // Type assertion needed due to complex query builder types
          }

          if (filters.status) {
            query = query.eq('status', filters.status) as any; // Type assertion needed
          }

          if (filters.vehicle_type) {
            query = query.eq('vehicle_type', filters.vehicle_type);
          }

          if (filters.fuel_type) {
            query = query.eq('fuel_type', filters.fuel_type);
          }

          if (filters.current_location_id) {
            query = query.eq('current_location_id', filters.current_location_id);
          }

          if (filters.current_driver_id) {
            query = query.eq('current_driver_id', filters.current_driver_id);
          }

          if (filters.make) {
            query = query.ilike('make', `%${filters.make}%`);
          }

          if (filters.year_from) {
            query = query.gte('year', filters.year_from);
          }

          if (filters.year_to) {
            query = query.lte('year', filters.year_to);
          }

          if (filters.acquisition_type) {
            query = query.eq('acquisition_type', filters.acquisition_type);
          }

          if (filters.tags && filters.tags.length > 0) {
            query = query.contains('tags', filters.tags);
          }

          const { data, error } = await query;

          if (error) throw error;

          set({ vehicles: data as VehicleWithRelations[], isLoading: false });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          toast.error(`Failed to fetch vehicles: ${error.message}`);
        }
      },

      // Fetch Single Vehicle with Relations
      fetchVehicleById: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const tableName = getVehiclesTableName();
          // Cast to any to bypass Supabase's strict table name types
          const table = tableName as any;
          const isUsingView = table === 'vehicles_unified_v';

          // Views don't support FK-based joins, so fetch vehicle data separately
          const { data: vehicle, error: vehicleError } = await supabase
            .from(table)
            .select('*')
            .eq('id', id)
            .maybeSingle();

          if (vehicleError) throw vehicleError;
          if (!vehicle) throw new Error('Vehicle not found or not accessible in this workspace');

          // If using the base table (not view), fetch relationships separately
          const vehicleWithRelations = vehicle as unknown as VehicleWithRelations;

          if (!isUsingView && vehicle) {
            // Fetch related data separately
            if ('current_location_id' in vehicle && vehicle.current_location_id) {
              const { data: location } = await supabase
                .from('facilities')
                .select('id, name')
                .eq('id', vehicle.current_location_id as string)
                .single();

              if (location) {
                vehicleWithRelations.current_location = location;
              }
            }

            if ('current_driver_id' in vehicle && vehicle.current_driver_id) {
              const { data: driver } = await supabase
                .from('drivers')
                .select('id, name, phone')
                .eq('id', vehicle.current_driver_id as string)
                .single();

              if (driver) {
                vehicleWithRelations.current_driver = {
                  id: driver.id,
                  full_name: driver.name,
                  email: '', // Email not available in drivers table
                };
              }
            }
          }

          set({ selectedVehicle: vehicleWithRelations, isLoading: false });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          toast.error(`Failed to fetch vehicle: ${error.message}`);
        }
      },

      // Create Vehicle
      createVehicle: async (data: VehicleFormData) => {
        set({ isLoading: true, error: null });
        try {
          const { data: user } = await supabase.auth.getUser();
          if (!user.user) throw new Error('Not authenticated');

          const userId = user.user.id;

          // Map form data to database schema
          // Map fuel_type to valid DB enum values (diesel | petrol | electric)
          const normalizeFuelType = (ft?: string): 'diesel' | 'petrol' | 'electric' => {
            if (!ft) return 'diesel';
            if (ft === 'gasoline' || ft === 'lpg' || ft === 'cng') return 'petrol';
            if (ft === 'hybrid') return 'electric';
            if (ft === 'diesel' || ft === 'petrol' || ft === 'electric') return ft;
            return 'diesel';
          };

          // Get active workspace ID
          const workspaceId = localStorage.getItem('biko_active_workspace_id');
          if (!workspaceId) throw new Error('No active workspace selected');

          // Convert empty strings to null for date fields and unique-constrained optional fields
          const dateFields = ['acquisition_date', 'warranty_expiry', 'insurance_expiry', 'registration_expiry'] as const;
          const nullableFields = [...dateFields, 'vin'] as const;
          const sanitizedCreateData = { ...data } as any;
          for (const field of nullableFields) {
            if (sanitizedCreateData[field] === '') {
              sanitizedCreateData[field] = null;
            }
          }

          // Destructure vehicle_type to remap it to the DB column 'type'.
          // Also strip fields that don't exist as DB columns: taxonomy FKs with non-UUID
          // static IDs, telemetry tracker fields (tracker_*), and vehicle outer-body
          // dimension fields (vehicle_*_cm) — none of these are in the vehicles table.
          // Also map cargo_capacity to capacity for the public.vehicles table.
          const {
            vehicle_type: vType,
            category_id: _catId,
            vehicle_type_id: _vtId,
            tracker_sim_number: _trackerSim,
            tracker_protocol: _trackerProto,
            tracker_capabilities: _trackerCaps,
            vehicle_length_cm: _vLenCm,
            vehicle_width_cm: _vWidCm,
            vehicle_height_cm: _vHgtCm,
            vendor_id: _vendorId,
            cargo_capacity,
            ...createRest
          } = sanitizedCreateData;
          const vehicleData = {
            ...createRest,
            ...(vType !== undefined ? { type: vType } : {}),
            ...(cargo_capacity !== undefined ? { capacity: cargo_capacity } : {}),
            workspace_id: workspaceId,
            capacity_m3: (data as any).capacity_m3 ?? 0,
            capacity_kg: (data as any).capacity_kg ?? 0,
            capacity: (data as any).capacity ?? 0, // Legacy field
            max_weight: (data as any).max_weight ?? (data as any).capacity_kg ?? (data as any).gross_weight_kg ?? 0,
            fuel_type: normalizeFuelType(data.fuel_type),
            status: normalizeStatus(data.status) as 'available' | 'in-use' | 'maintenance',
            created_by: userId,
            updated_by: userId,
          };

          // Create a type-safe insert operation
          const { data: result, error } = await supabase
            .from('vehicles')
            .insert(vehicleData as any) // Type assertion needed due to complex types
            .select()
            .single() as { data: Vehicle; error: any };

          if (error) throw error;

          // Refresh vehicles list
          await get().fetchVehicles();

          set({ isLoading: false });
          toast.success('Vehicle created successfully');

          return result;
        } catch (error: any) {
          console.error('Failed to create vehicle:', error);
          const userMessage =
            error?.code === '23505' && error?.message?.includes('plate_number')
              ? 'A vehicle with this plate number already exists.'
              : `Failed to create vehicle: ${error.message}`;
          set({ error: userMessage, isLoading: false });
          toast.error(userMessage);
          throw error;
        }
      },

      // Update Vehicle
      updateVehicle: async (id: string, data: Partial<VehicleFormData>) => {
        set({ isLoading: true, error: null });
        try {
          const { data: user } = await supabase.auth.getUser();
          if (!user.user) throw new Error('Not authenticated');

          const userId = user.user.id;

          // Map fuel_type to valid DB enum values (diesel | petrol | electric)
          const normalizeFuelType = (ft?: string): 'diesel' | 'petrol' | 'electric' | undefined => {
            if (!ft) return undefined;
            if (ft === 'gasoline' || ft === 'lpg' || ft === 'cng') return 'petrol';
            if (ft === 'hybrid') return 'electric';
            if (ft === 'diesel' || ft === 'petrol' || ft === 'electric') return ft;
            return 'diesel';
          };

          // Convert empty strings to null for date fields and unique-constrained optional fields
          const dateFields = ['acquisition_date', 'warranty_expiry', 'insurance_expiry', 'registration_expiry'] as const;
          const nullableFields = [...dateFields, 'vin'] as const;
          const sanitizedData = { ...data } as any;
          for (const field of nullableFields) {
            if (sanitizedData[field] === '') {
              sanitizedData[field] = null;
            }
          }

          // Create update payload with proper type mapping
          // Destructure vehicle_type to remap it to the DB column 'type'
          // Also map cargo_capacity to capacity for the public.vehicles table
          const {
            vehicle_type,
            cargo_capacity,
            tiered_config: tieredConfigRaw,
            ...rest
          } = sanitizedData;

          // tiered_config arrives as { tiers: TierConfig[] } from VehicleForm — pass through as-is
          const tieredConfigValue = tieredConfigRaw !== undefined ? tieredConfigRaw : undefined;

          const updateData: Partial<Vehicle> = {
            ...rest,
            ...(vehicle_type !== undefined ? { type: vehicle_type } : {}),
            ...(cargo_capacity !== undefined ? { capacity: cargo_capacity } : {}),
            ...(tieredConfigValue !== undefined ? { tiered_config: tieredConfigValue } : {}),
            fuel_type: normalizeFuelType(data.fuel_type) as any,
            status: data.status ? (normalizeStatus(data.status) as 'available' | 'in-use' | 'maintenance') : undefined,
            updated_by: userId,
          };

          const { error } = await supabase
            .from('vehicles')
            .update(updateData)
            .eq('id', id);

          if (error) throw error;

          // Refresh vehicles list
          await get().fetchVehicles();

          // Refresh selected vehicle if it's the one being updated
          if (get().selectedVehicle?.id === id) {
            await get().fetchVehicleById(id);
          }

          set({ isLoading: false });
          toast.success('Vehicle updated successfully');
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          toast.error(`Failed to update vehicle: ${error.message}`);
          throw error;
        }
      },

      // Delete Vehicle
      deleteVehicle: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const { error, count } = await supabase
            .from('vehicles')
            .delete({ count: 'exact' })
            .eq('id', id);

          if (error) throw error;
          if (count === 0) throw new Error('Vehicle not found or you do not have permission to delete it');

          set((state) => ({
            vehicles: state.vehicles.filter((v) => v.id !== id),
            isLoading: false,
          }));
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },

      // Upload Document
      uploadDocument: async (vehicleId: string, file: File, type: string) => {
        set({ isLoading: true, error: null });
        try {
          // Upload file to Supabase Storage
          const fileExt = file.name.split('.').pop();
          const fileName = `${vehicleId}/documents/${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('vlms-documents')
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          // Get public URL
          const { data: urlData } = supabase.storage
            .from('vlms-documents')
            .getPublicUrl(fileName);

          // Get current vehicle
          const { data: vehicle, error: fetchError } = await supabase
            .from('vehicles')
            .select('documents')
            .eq('id', vehicleId)
            .single();

          if (fetchError) throw fetchError;

          // Safely update vehicle documents array
          const documents = safeArray(vehicle.documents);
          documents.push({
            url: urlData.publicUrl,
            type,
            name: file.name,
            uploaded_at: new Date().toISOString(),
            size: file.size,
          });

          // Update vehicle with new documents array
          const { error: updateError } = await supabase
            .from('vehicles')
            .update({ documents })
            .eq('id', vehicleId);

          if (updateError) throw updateError;

          // Refresh vehicle
          await get().fetchVehicleById(vehicleId);

          set({ isLoading: false });
          toast.success('Document uploaded successfully');
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          toast.error(`Failed to upload document: ${error.message}`);
          throw error;
        }
      },

      // Upload Photo
      uploadPhoto: async (vehicleId: string, file: File, caption?: string) => {
        set({ isLoading: true, error: null });
        try {
          // Upload file to Supabase Storage
          const fileExt = file.name.split('.').pop();
          const fileName = `${vehicleId}/${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('vlms-photos')
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          // Get public URL
          const { data: urlData } = supabase.storage
            .from('vlms-photos')
            .getPublicUrl(fileName);

          // Get current vehicle
          const { data: vehicle, error: fetchError } = await supabase
            .from('vehicles')
            .select('photos')
            .eq('id', vehicleId)
            .single();

          if (fetchError) throw fetchError;

          // Add new photo to array with type safety
          const photos = safeArray(vehicle.photos);
          photos.push({
            url: urlData.publicUrl,
            caption: caption || '',
            uploaded_at: new Date().toISOString(),
          });

          // Update vehicle with new photos array
          const { error: updateError } = await supabase
            .from('vehicles')
            .update({ photos })
            .eq('id', vehicleId);

          if (updateError) throw updateError;

          // Refresh vehicle
          await get().fetchVehicleById(vehicleId);

          set({ isLoading: false });
          toast.success('Photo uploaded successfully');
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          toast.error(`Failed to upload photo: ${error.message}`);
          throw error;
        }
      },

      // Remove Document
      removeDocument: async (vehicleId: string, documentUrl: string) => {
        set({ isLoading: true, error: null });
        try {
          // Get current vehicle
          const { data: vehicle, error: fetchError } = await supabase
            .from('vehicles')
            .select('documents')
            .eq('id', vehicleId)
            .single();

          if (fetchError) throw fetchError;

          // Safely filter documents array
          const documents = safeArray(vehicle.documents);
          const updatedDocuments = documents.filter(
            (doc) => doc.url !== documentUrl
          );

          // Update vehicle
          const { error: updateError } = await supabase
            .from('vehicles')
            .update({ documents: updatedDocuments })
            .eq('id', vehicleId);

          if (updateError) throw updateError;

          // Delete from storage
          const path = documentUrl.split('/vlms-documents/')[1];
          if (path) {
            await supabase.storage.from('vlms-documents').remove([path]);
          }

          // Refresh vehicle
          await get().fetchVehicleById(vehicleId);

          set({ isLoading: false });
          toast.success('Document removed successfully');
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          toast.error(`Failed to remove document: ${error.message}`);
          throw error;
        }
      },

      // Remove Photo
      removePhoto: async (vehicleId: string, photoUrl: string) => {
        set({ isLoading: true, error: null });
        try {
          // Get current vehicle
          const { data: vehicle, error: fetchError } = await supabase
            .from('vehicles')
            .select('photos')
            .eq('id', vehicleId)
            .single();

          if (fetchError) throw fetchError;

          // Remove photo from array
          const photos = safeArray(vehicle.photos).filter((photo: any) => photo.url !== photoUrl);

          // Update vehicle
          const { error: updateError } = await supabase
            .from('vehicles')
            .update({ photos })
            .eq('id', vehicleId);

          if (updateError) throw updateError;

          // Delete from storage
          const path = photoUrl.split('/vlms-photos/')[1];
          if (path) {
            await supabase.storage.from('vlms-photos').remove([path]);
          }

          // Refresh vehicle
          await get().fetchVehicleById(vehicleId);

          set({ isLoading: false });
          toast.success('Photo removed successfully');
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          toast.error(`Failed to remove photo: ${error.message}`);
          throw error;
        }
      },
    }),
    { name: 'vlms-vehicles' }
  )
);
