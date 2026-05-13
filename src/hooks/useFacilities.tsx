import { useQuery, useMutation, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type {
  Facility,
  FacilityService,
  FacilityDelivery,
  FacilityStock,
  FacilityAuditLog,
} from '@/types';
import { toast } from 'sonner';
import { generateWarehouseCode } from '@/lib/warehouse-code-generator';
import type { FacilityFilters } from '@/lib/facility-validation';

// ========================================
// Helper Functions
// ========================================

/**
 * Maps database facility to TypeScript Facility interface
 */
function mapDbToFacility(dbFacility: any): Facility {
  return {
    id: dbFacility.id,
    name: dbFacility.name,
    address: dbFacility.address,
    lat: Number(dbFacility.lat),
    lng: Number(dbFacility.lng),
    type: dbFacility.type,
    phone: dbFacility.phone || undefined,
    contactPerson: dbFacility.contact_person || undefined,
    capacity: dbFacility.capacity || undefined,
    operatingHours: dbFacility.operating_hours || undefined,
    warehouse_code: dbFacility.warehouse_code || '',
    state: dbFacility.state || 'kano',
    ip_name: dbFacility.ip_name || undefined,
    funding_source: dbFacility.funding_source || undefined,
    programme: dbFacility.programme || undefined,
    ip_names: dbFacility.ip_names || [],
    funding_sources: dbFacility.funding_sources || [],
    programmes: dbFacility.programmes || [],
    pcr_service: dbFacility.pcr_service || false,
    cd4_service: dbFacility.cd4_service || false,
    type_of_service: dbFacility.type_of_service || undefined,
    service_zone: dbFacility.service_zone || undefined,
    level_of_care: dbFacility.level_of_care || undefined,
    lga: dbFacility.lga || undefined,
    ward: dbFacility.ward || undefined,
    contact_name_pharmacy: dbFacility.contact_name_pharmacy || undefined,
    designation: dbFacility.designation || undefined,
    phone_pharmacy: dbFacility.phone_pharmacy || undefined,
    email: dbFacility.email || undefined,
    storage_capacity: dbFacility.storage_capacity || undefined,
    zone_id: dbFacility.zone_id || undefined,
    workspace_id: dbFacility.workspace_id || undefined,
    created_at: dbFacility.created_at,
    updated_at: dbFacility.updated_at,
    created_by: dbFacility.created_by,
    updated_by: dbFacility.updated_by,
    deleted_at: dbFacility.deleted_at,
    deleted_by: dbFacility.deleted_by,
  };
}

/**
 * Maps TypeScript Facility to database insert format
 */
function mapFacilityToDb(facility: Partial<Facility>, workspaceId?: string) {
  const dbObj: Record<string, unknown> = {
    name: facility.name,
    address: facility.address,
    lat: facility.lat,
    lng: facility.lng,
    type: facility.type,
    phone: facility.phone || null,
    contact_person: facility.contactPerson || null,
    capacity: facility.capacity || null,
    operating_hours: facility.operatingHours || null,
    warehouse_code: facility.warehouse_code || null,
    state: facility.state || 'kano',
    ip_name: facility.ip_name || null,
    funding_source: facility.funding_source || null,
    programme: facility.programme || null,
    // Array fields — only included when explicitly provided so partial updates
    // don't wipe existing values (undefined is ignored by the Supabase client)
    ...(facility.ip_names !== undefined && { ip_names: facility.ip_names }),
    ...(facility.funding_sources !== undefined && { funding_sources: facility.funding_sources }),
    ...(facility.programmes !== undefined && { programmes: facility.programmes }),
    pcr_service: facility.pcr_service || false,
    cd4_service: facility.cd4_service || false,
    type_of_service: facility.type_of_service || null,
    service_zone: facility.service_zone || null,
    level_of_care: facility.level_of_care || null,
    lga: facility.lga || null,
    ward: facility.ward || null,
    contact_name_pharmacy: facility.contact_name_pharmacy || null,
    designation: facility.designation || null,
    phone_pharmacy: facility.phone_pharmacy || null,
    email: facility.email || null,
    storage_capacity: facility.storage_capacity || null,
    zone_id: facility.zone_id || null,
  };

  // Include workspace_id: prefer explicit param, then facility field
  const wsId = workspaceId || facility.workspace_id;
  if (wsId) {
    dbObj.workspace_id = wsId;
  }

  return dbObj;
}

// ========================================
// Core CRUD Hooks
// ========================================

/**
 * Fetches all facilities with optional filters and pagination
 */
export function useFacilities(filters?: FacilityFilters, page?: number, pageSize: number = 50) {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['facilities', workspaceId, filters, page],
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000, // Facilities rarely change — 5 min is safe
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    queryFn: async () => {
      let query = supabase
        .from('facilities')
        .select('*', { count: 'exact' })
        .eq('workspace_id', workspaceId!)
        .is('deleted_at', null)
        .order('name');

      // Apply filters
      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,address.ilike.%${filters.search}%,warehouse_code.ilike.%${filters.search}%,lga.ilike.%${filters.search}%`);
      }
      if (filters?.state) {
        query = query.eq('state', filters.state);
      }
      if (filters?.ip_name) {
        query = query.contains('ip_names', [filters.ip_name]);
      }
      if (filters?.funding_source) {
        query = query.contains('funding_sources', [filters.funding_source]);
      }
      if (filters?.programme) {
        query = query.contains('programmes', [filters.programme]);
      }
      if (filters?.zone_id) {
        query = query.eq('zone_id', filters.zone_id);
      }
      if (filters?.service_zone) {
        query = query.eq('service_zone', filters.service_zone);
      }
      if (filters?.level_of_care) {
        query = query.eq('level_of_care', filters.level_of_care);
      }
      if (filters?.lga) {
        query = query.eq('lga', filters.lga);
      }
      if (filters?.type) {
        query = query.eq('type', filters.type);
      }
      if (filters?.pcr_service !== undefined) {
        query = query.eq('pcr_service', filters.pcr_service);
      }
      if (filters?.cd4_service !== undefined) {
        query = query.eq('cd4_service', filters.cd4_service);
      }

      // New map-specific filters
      if (filters?.ward) {
        query = query.eq('ward', filters.ward);
      }
      if (filters?.warehouseCodeSearch) {
        query = query.ilike('warehouse_code', `%${filters.warehouseCodeSearch}%`);
      }
      if (filters?.storageCapacityMin !== undefined) {
        query = query.gte('storage_capacity', filters.storageCapacityMin);
      }
      if (filters?.storageCapacityMax !== undefined) {
        query = query.lte('storage_capacity', filters.storageCapacityMax);
      }
      if (filters?.capacityMin !== undefined) {
        query = query.gte('capacity', filters.capacityMin);
      }
      if (filters?.capacityMax !== undefined) {
        query = query.lte('capacity', filters.capacityMax);
      }

      // Apply pagination
      if (page !== undefined) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        facilities: (data || []).map(mapDbToFacility),
        total: count || 0,
      };
    },
  });
}

/**
 * Fetches a single facility by ID
 */
export function useFacility(id: string | undefined): UseQueryResult<Facility, Error> {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: ['facility', id, workspaceId],
    queryFn: async () => {
      if (!id) throw new Error('Facility ID is required');

      const { data, error } = await supabase
        .from('facilities')
        .select('*')
        .eq('id', id)
        .eq('workspace_id', workspaceId!)
        .single();

      if (error) throw error;
      return mapDbToFacility(data);
    },
    enabled: !!id && !!workspaceId,
  });
}

/**
 * Creates a new facility
 */
export function useCreateFacility() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (facility: Partial<Facility>) => {
      if (!workspaceId) throw new Error('No workspace selected');

      // Generate warehouse code if not provided
      if (!facility.warehouse_code) {
        facility.warehouse_code = await generateWarehouseCode(facility.service_zone);
      }

      const dbFacility = mapFacilityToDb(facility, workspaceId);

      const { data, error } = await supabase
        .from('facilities') // isolation-ok — workspace_id set inside mapFacilityToDb()
        .insert(dbFacility)
        .select()
        .single();

      if (error) throw error;

      // Create default 11 services for the facility
      const services = [
        'Medical Services',
        'Surgical Services',
        'Pediatrics Services',
        'Ambulance Services',
        'Special Clinical Services',
        'Obstetrics & Gynecology Services',
        'Dental Services',
        'Onsite Laboratory',
        'Mortuary Services',
        'Onsite Imaging',
        'Onsite Pharmacy',
      ];

      await supabase.from('facility_services').insert(
        services.map(service => ({
          facility_id: data.id,
          service_name: service,
          availability: false,
        }))
      );

      return mapDbToFacility(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      toast.success('Facility created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create facility: ${error.message}`);
    },
  });
}

/**
 * Updates an existing facility
 */
export function useUpdateFacility() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Facility> }) => {
      const dbUpdates = mapFacilityToDb(updates);

      const { data, error } = await supabase
        .from('facilities')
        .update(dbUpdates)
        .eq('id', id)
        .eq('workspace_id', workspaceId!)
        .select()
        .single();

      if (error) throw error;
      return mapDbToFacility(data);
    },
    // Optimistic update
    onMutate: async ({ id, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['facilities'] });
      await queryClient.cancelQueries({ queryKey: ['facility', id, workspaceId] });

      // Snapshot previous values
      const previousFacilities = queryClient.getQueryData(['facilities']);
      const previousFacility = queryClient.getQueryData(['facility', id, workspaceId]);

      // Optimistically update cache
      queryClient.setQueryData(['facility', id, workspaceId], (old: any) => ({
        ...old,
        ...updates,
      }));

      return { previousFacilities, previousFacility };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      queryClient.invalidateQueries({ queryKey: ['facility', variables.id, workspaceId] });
      toast.success('Facility updated successfully');
    },
    onError: (error: Error, variables, context) => {
      // Rollback on error
      if (context?.previousFacilities) {
        queryClient.setQueryData(['facilities'], context.previousFacilities);
      }
      if (context?.previousFacility) {
        queryClient.setQueryData(['facility', variables.id, workspaceId], context.previousFacility);
      }
      toast.error(`Failed to update facility: ${error.message}`);
    },
  });
}

/**
 * Soft deletes a facility
 */
export function useDeleteFacility() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('facilities')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('workspace_id', workspaceId!);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      toast.success('Facility deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete facility: ${error.message}`);
    },
  });
}

/**
 * Bulk delete facilities
 */
export function useBulkDeleteFacilities() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('facilities')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', ids)
        .eq('workspace_id', workspaceId!);

      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      toast.success(`${ids.length} facilities deleted successfully`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete facilities: ${error.message}`);
    },
  });
}

// ========================================
// Facility Services Hooks
// ========================================

/**
 * Fetches services for a facility
 */
export function useFacilityServices(facilityId: string | undefined) {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: ['facility-services', facilityId, workspaceId],
    queryFn: async () => {
      if (!facilityId) throw new Error('Facility ID is required');

      const { data, error } = await supabase
        .from('facility_services')
        .select('*')
        .eq('facility_id', facilityId)
        .order('service_name');

      if (error) throw error;
      return data as FacilityService[];
    },
    enabled: !!facilityId,
  });
}

/**
 * Updates facility services
 */
export function useUpdateFacilityServices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      facilityId,
      services,
    }: {
      facilityId: string;
      services: Partial<FacilityService>[];
    }) => {
      const updates = services.map(service =>
        supabase
          .from('facility_services')
          .update({
            availability: service.availability,
            notes: service.notes,
          })
          .eq('facility_id', facilityId)
          .eq('service_name', service.service_name)
      );

      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) {
        throw new Error(`Failed to update ${errors.length} services`);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['facility-services', variables.facilityId] });
      toast.success('Services updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update services: ${error.message}`);
    },
  });
}

// ========================================
// Facility Deliveries Hooks
// ========================================

/**
 * Fetches delivery history for a facility
 */
export function useFacilityDeliveries(facilityId: string | undefined, page: number = 0, pageSize: number = 20) {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: ['facility-deliveries', facilityId, workspaceId, page],
    queryFn: async () => {
      if (!facilityId) throw new Error('Facility ID is required');

      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from('facility_deliveries')
        .select('*', { count: 'exact' })
        .eq('facility_id', facilityId)
        .order('delivery_date', { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        deliveries: (data || []) as FacilityDelivery[],
        total: count || 0,
      };
    },
    enabled: !!facilityId,
  });
}

// ========================================
// Facility Stock Hooks
// ========================================

/**
 * Fetches stock information for a facility
 */
export function useFacilityStock(facilityId: string | undefined) {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: ['facility-stock', facilityId, workspaceId],
    queryFn: async () => {
      if (!facilityId) throw new Error('Facility ID is required');

      const { data, error } = await supabase
        .from('facility_stock')
        .select('*')
        .eq('facility_id', facilityId)
        .order('product_name');

      if (error) throw error;
      return data as FacilityStock[];
    },
    enabled: !!facilityId,
  });
}

/**
 * Updates stock for a facility
 */
export function useUpdateStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      facilityId,
      stock,
    }: {
      facilityId: string;
      stock: Partial<FacilityStock> & { product_id?: string };
    }) => {
      const { data, error } = await supabase
        .from('facility_stock')
        .upsert({
          facility_id: facilityId,
          product_id: stock.product_id,
          product_name: stock.product_name,
          quantity: stock.quantity,
          unit: stock.unit,
          last_updated: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as FacilityStock;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['facility-stock', variables.facilityId] });
      toast.success('Stock updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update stock: ${error.message}`);
    },
  });
}

// ========================================
// Audit Log Hook
// ========================================

/**
 * Fetches audit log for a facility
 */
export function useFacilityAuditLog(facilityId: string | undefined, page: number = 0, pageSize: number = 20) {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: ['facility-audit-log', facilityId, workspaceId, page],
    queryFn: async () => {
      if (!facilityId) throw new Error('Facility ID is required');

      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from('facility_audit_log')
        .select('*', { count: 'exact' })
        .eq('facility_id', facilityId)
        .order('timestamp', { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        logs: (data || []) as FacilityAuditLog[],
        total: count || 0,
      };
    },
    enabled: !!facilityId,
  });
}

// ========================================
// Legacy Hook (for backwards compatibility)
// ========================================

/**
 * @deprecated Use useFacilities() instead
 */
export function useAddFacility() {
  return useCreateFacility();
}
