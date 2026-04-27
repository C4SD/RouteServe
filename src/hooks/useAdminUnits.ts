/**
 * React Query hooks for admin_units table
 *
 * Admin units represent hierarchical administrative boundaries from OpenStreetMap:
 * - Level 2: Country (Nigeria)
 * - Level 4: State (e.g., Kano State)
 * - Level 6: LGA (Local Government Area)
 * - Level 8: Ward
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DEFAULT_COUNTRY_ID } from '@/lib/constants';

export interface AdminUnit {
  id: string;
  country_id: string;
  workspace_id: string | null;
  parent_id: string | null;
  osm_id: string | null;
  osm_type: string | null;
  admin_level: number;
  name: string;
  name_en: string | null;
  name_local: string | null;
  geometry: any; // PostGIS MultiPolygon
  center_point: any; // PostGIS Point
  bounds: any; // PostGIS Polygon
  population: number | null;
  area_km2: number | null;
  metadata: Record<string, any>;
  zone_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminUnitFilters {
  countryId?: string;
  workspaceId?: string;
  parentId?: string;
  adminLevel?: number;
  isActive?: boolean;
}

/**
 * Fetch admin units with optional filters
 */
export function useAdminUnits(filters?: AdminUnitFilters) {
  return useQuery({
    queryKey: ['admin-units', filters],
    queryFn: async () => {
      let query = supabase
        .from('admin_units')
        .select('*')
        .order('admin_level', { ascending: true })
        .order('name', { ascending: true });

      if (filters?.countryId) {
        query = query.eq('country_id', filters.countryId);
      }

      if (filters?.workspaceId) {
        query = query.eq('workspace_id', filters.workspaceId);
      }

      if (filters?.parentId !== undefined) {
        query = filters.parentId === null
          ? query.is('parent_id', null)
          : query.eq('parent_id', filters.parentId);
      }

      if (filters?.adminLevel) {
        query = query.eq('admin_level', filters.adminLevel);
      }

      if (filters?.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch admin units: ${error.message}`);
      }

      return data as AdminUnit[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Fetch admin units by level (States, LGAs, Wards)
 */
export function useAdminUnitsByLevel(
  adminLevel: number,
  countryId: string,
  workspaceId?: string
) {
  return useAdminUnits({
    adminLevel,
    countryId,
    workspaceId,
    isActive: true,
  });
}

/**
 * Fetch States (admin_level = 4) for Nigeria
 * Deduplicates by name since seed migrations may have created duplicate entries
 */
export function useStates(countryId: string = DEFAULT_COUNTRY_ID) {
  return useQuery({
    queryKey: ['states', countryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_units')
        .select('*')
        .eq('country_id', countryId)
        .eq('admin_level', 4)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch states: ${error.message}`);
      }

      // Deduplicate by name (keep first occurrence)
      const seen = new Set<string>();
      const unique = (data as AdminUnit[]).filter((s) => {
        if (seen.has(s.name)) return false;
        seen.add(s.name);
        return true;
      });

      return unique;
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch LGAs (admin_level = 6) for a State
 */
export function useLGAsByState(
  stateId?: string | null,
  countryId: string = DEFAULT_COUNTRY_ID
) {
  return useQuery({
    queryKey: ['lgas-by-state', stateId, countryId],
    queryFn: async () => {
      let query = supabase
        .from('admin_units')
        .select('*')
        .eq('country_id', countryId)
        .eq('admin_level', 6) // LGA level
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (stateId) {
        query = query.eq('parent_id', stateId);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch LGAs: ${error.message}`);
      }

      return data as AdminUnit[];
    },
    enabled: !!countryId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch all LGAs (admin_level = 6) with zone assignment support
 * Used for zone management - shows all LGAs with their zone assignments
 */
export function useAllLGAsWithZones(
  filters?: {
    zone_id?: string;
    stateId?: string;
    search?: string;
    countryId?: string;
    workspaceId?: string;
  }
) {
  const countryId = filters?.countryId;
  return useQuery({
    queryKey: ['all-lgas-with-zones', filters],
    queryFn: async () => {
      let query = supabase
        .from('admin_units')
        .select(`
          *,
          parent:parent_id (
            id,
            name,
            admin_level
          )
        `)
        .eq('admin_level', 6) // LGA level
        .eq('is_active', true)
        .order('name', { ascending: true });

      // Only filter by country if explicitly provided — avoids hardcoded UUID
      // mismatches when the DB country record ID differs from the constant.
      if (countryId) {
        query = query.eq('country_id', countryId);
      }

      if (filters?.workspaceId) {
        query = query.eq('workspace_id', filters.workspaceId);
      }

      if (filters?.zone_id) {
        query = query.eq('zone_id', filters.zone_id);
      }

      if (filters?.stateId) {
        query = query.eq('parent_id', filters.stateId);
      }

      if (filters?.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch LGAs: ${error.message}`);
      }

      return data as (AdminUnit & {
        parent?: { id: string; name: string; admin_level: number } | null;
      })[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Get a single admin unit by ID
 */
export function useAdminUnit(id: string | null | undefined) {
  return useQuery({
    queryKey: ['admin-unit', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('admin_units')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw new Error(`Failed to fetch admin unit: ${error.message}`);
      }

      return data as AdminUnit;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fuzzy search admin units by name using PostgreSQL pg_trgm
 */
export function useSearchAdminUnits(
  searchTerm: string | null | undefined,
  countryId: string,
  adminLevel?: number,
  threshold: number = 0.65
) {
  return useQuery({
    queryKey: ['search-admin-units', searchTerm, countryId, adminLevel, threshold],
    queryFn: async () => {
      if (!searchTerm || searchTerm.trim().length < 2) return [];

      // Use the PostgreSQL fuzzy_match_admin_unit function
      const { data, error } = await supabase.rpc('fuzzy_match_admin_unit', {
        p_name: searchTerm.trim(),
        p_country_id: countryId,
        p_admin_level: adminLevel || null,
        p_threshold: threshold,
      });

      if (error) {
        throw new Error(`Failed to search admin units: ${error.message}`);
      }

      return data as AdminUnit[];
    },
    enabled: !!searchTerm && searchTerm.trim().length >= 2,
    staleTime: 1000 * 60, // 1 minute (searches can be more dynamic)
  });
}

/**
 * Find admin unit by geographic point (reverse geocoding)
 */
export function useFindAdminUnitByPoint(
  lat: number | null,
  lng: number | null,
  adminLevel?: number,
  countryId?: string
) {
  return useQuery({
    queryKey: ['admin-unit-by-point', lat, lng, adminLevel, countryId],
    queryFn: async () => {
      if (lat === null || lng === null) return null;

      const { data, error } = await supabase.rpc('find_admin_unit_by_point', {
        p_lat: lat,
        p_lng: lng,
        p_admin_level: adminLevel || null,
        p_country_id: countryId || null,
      });

      if (error) {
        throw new Error(`Failed to find admin unit: ${error.message}`);
      }

      return data && data.length > 0 ? (data[0] as AdminUnit) : null;
    },
    enabled: lat !== null && lng !== null,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Get all descendant admin units (children, grandchildren, etc.)
 */
export function useAdminUnitDescendants(unitId: string | null | undefined) {
  return useQuery({
    queryKey: ['admin-unit-descendants', unitId],
    queryFn: async () => {
      if (!unitId) return [];

      const { data, error } = await supabase.rpc('get_admin_unit_descendants', {
        unit_id: unitId,
      });

      if (error) {
        throw new Error(`Failed to fetch descendants: ${error.message}`);
      }

      return data as AdminUnit[];
    },
    enabled: !!unitId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Create a new admin unit (admin-only)
 */
export function useCreateAdminUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newUnit: Partial<AdminUnit>) => {
      const { data, error } = await supabase
        .from('admin_units')
        .insert([newUnit])
        .select()
        .single();

      if (error) throw error;
      return data as AdminUnit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-units'] });
      queryClient.invalidateQueries({ queryKey: ['lgas-by-state'] });
      toast.success('Admin unit created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create admin unit: ${error.message}`);
    },
  });
}

/**
 * Update an admin unit (admin-only)
 */
export function useUpdateAdminUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<AdminUnit>;
    }) => {
      const { data, error } = await supabase
        .from('admin_units')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as AdminUnit;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-units'] });
      queryClient.invalidateQueries({ queryKey: ['admin-unit', data.id] });
      queryClient.invalidateQueries({ queryKey: ['lgas-by-state'] });
      toast.success('Admin unit updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update admin unit: ${error.message}`);
    },
  });
}

/**
 * Delete an admin unit (admin-only)
 */
export function useDeleteAdminUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('admin_units')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-units'] });
      queryClient.invalidateQueries({ queryKey: ['lgas-by-state'] });
      toast.success('Admin unit deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete admin unit: ${error.message}`);
    },
  });
}

export default useAdminUnits;
