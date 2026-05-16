/**
 * VLMS Vehicle Onboarding - Vehicle Categories Hook
 * React Query hooks for fetching and managing vehicle categories
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { VehicleCategory, CategorySource } from '@/types/vlms-onboarding';
import { toast } from 'sonner';

// =====================================================
// QUERY KEYS
// =====================================================

export const vehicleCategoryKeys = {
  all: ['vehicle-categories'] as const,
  lists: () => [...vehicleCategoryKeys.all, 'list'] as const,
  list: (filters?: VehicleCategoryFilters) => [...vehicleCategoryKeys.lists(), filters] as const,
  details: () => [...vehicleCategoryKeys.all, 'detail'] as const,
  detail: (id: string) => [...vehicleCategoryKeys.details(), id] as const,
};

// =====================================================
// TYPES
// =====================================================

export interface VehicleCategoryFilters {
  source?: CategorySource;
  search?: string;
}

// =====================================================
// QUERY FUNCTIONS
// =====================================================

/**
 * Fetch all vehicle categories with optional filters
 */
async function fetchVehicleCategories(
  filters?: VehicleCategoryFilters
): Promise<VehicleCategory[]> {
  let query = supabase
    .from('vehicle_categories')
    .select('*')
    .order('source', { ascending: false }) // 'eu' before 'biko'
    .order('display_name', { ascending: true });

  // Apply filters
  if (filters?.source) {
    query = query.eq('source', filters.source);
  }

  if (filters?.search) {
    query = query.or(
      `display_name.ilike.%${filters.search}%,name.ilike.%${filters.search}%,code.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching vehicle categories:', error);
    throw new Error(`Failed to fetch vehicle categories: ${error.message}`);
  }

  return data as VehicleCategory[];
}

/**
 * Fetch a single vehicle category by ID
 */
async function fetchVehicleCategory(id: string): Promise<VehicleCategory> {
  const { data, error } = await supabase
    .from('vehicle_categories')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching vehicle category:', error);
    throw new Error(`Failed to fetch vehicle category: ${error.message}`);
  }

  return data as VehicleCategory;
}

/**
 * Fetch a vehicle category by code
 */
async function fetchVehicleCategoryByCode(code: string): Promise<VehicleCategory> {
  const { data, error } = await supabase
    .from('vehicle_categories')
    .select('*')
    .eq('code', code)
    .single();

  if (error) {
    console.error('Error fetching vehicle category by code:', error);
    throw new Error(`Failed to fetch vehicle category: ${error.message}`);
  }

  return data as VehicleCategory;
}

// =====================================================
// HOOKS
// =====================================================

/**
 * Hook to fetch all vehicle categories
 */
export function useVehicleCategories(filters?: VehicleCategoryFilters) {
  return useQuery({
    queryKey: vehicleCategoryKeys.list(filters),
    queryFn: () => fetchVehicleCategories(filters),
    staleTime: 30 * 60 * 1000, // 30 minutes (categories rarely change)
    gcTime: 60 * 60 * 1000, // 1 hour
  });
}

/**
 * Hook to fetch EU categories only
 */
export function useEUCategories() {
  return useVehicleCategories({ source: 'eu' });
}

/**
 * Hook to fetch RouteServe categories only
 */
export function useRouteServeCategories() {
  return useVehicleCategories({ source: 'biko' });
}

/**
 * Hook to fetch a single category by ID
 */
export function useVehicleCategory(id: string) {
  return useQuery({
    queryKey: vehicleCategoryKeys.detail(id),
    queryFn: () => fetchVehicleCategory(id),
    enabled: !!id,
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Hook to fetch a category by code
 */
export function useVehicleCategoryByCode(code: string) {
  return useQuery({
    queryKey: [...vehicleCategoryKeys.all, 'code', code] as const,
    queryFn: () => fetchVehicleCategoryByCode(code),
    enabled: !!code,
    staleTime: 30 * 60 * 1000,
  });
}

// =====================================================
// MUTATION FUNCTIONS (Admin only)
// =====================================================

interface CreateVehicleCategoryInput {
  code: string;
  name: string;
  display_name: string;
  source: CategorySource;
  description?: string;
  icon_name?: string;
  default_tier_config?: any;
}

/**
 * Create a new vehicle category (admin only)
 */
async function createVehicleCategory(
  input: CreateVehicleCategoryInput
): Promise<VehicleCategory> {
  const { data, error } = await supabase
    .from('vehicle_categories')
    .insert(input)
    .select()
    .single();

  if (error) {
    console.error('Error creating vehicle category:', error);
    throw new Error(`Failed to create vehicle category: ${error.message}`);
  }

  return data as VehicleCategory;
}

/**
 * Update a vehicle category (admin only)
 */
async function updateVehicleCategory(
  id: string,
  updates: Partial<CreateVehicleCategoryInput>
): Promise<VehicleCategory> {
  const { data, error } = await supabase
    .from('vehicle_categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating vehicle category:', error);
    throw new Error(`Failed to update vehicle category: ${error.message}`);
  }

  return data as VehicleCategory;
}

/**
 * Delete a vehicle category (admin only)
 */
async function deleteVehicleCategory(id: string): Promise<void> {
  const { error } = await supabase.from('vehicle_categories').delete().eq('id', id);

  if (error) {
    console.error('Error deleting vehicle category:', error);
    throw new Error(`Failed to delete vehicle category: ${error.message}`);
  }
}

// =====================================================
// MUTATION HOOKS (Admin only)
// =====================================================

/**
 * Hook to create a new vehicle category
 */
export function useCreateVehicleCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createVehicleCategory,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: vehicleCategoryKeys.all });
      toast.success(`Category "${data.display_name}" created successfully`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create category: ${error.message}`);
    },
  });
}

/**
 * Hook to update a vehicle category
 */
export function useUpdateVehicleCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<CreateVehicleCategoryInput> }) =>
      updateVehicleCategory(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: vehicleCategoryKeys.all });
      toast.success(`Category "${data.display_name}" updated successfully`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update category: ${error.message}`);
    },
  });
}

/**
 * Hook to delete a vehicle category
 */
export function useDeleteVehicleCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteVehicleCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vehicleCategoryKeys.all });
      toast.success('Category deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete category: ${error.message}`);
    },
  });
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Group categories by source
 */
export function groupCategoriesBySource(categories: VehicleCategory[]): {
  eu: VehicleCategory[];
  biko: VehicleCategory[];
} {
  return categories.reduce(
    (acc, category) => {
      if (category.source === 'eu') {
        acc.eu.push(category);
      } else {
        acc.biko.push(category);
      }
      return acc;
    },
    { eu: [] as VehicleCategory[], biko: [] as VehicleCategory[] }
  );
}

/**
 * Find category by code
 */
export function findCategoryByCode(
  categories: VehicleCategory[],
  code: string
): VehicleCategory | undefined {
  return categories.find((c) => c.code === code);
}

/**
 * Filter categories by search term
 */
export function filterCategories(
  categories: VehicleCategory[],
  searchTerm: string
): VehicleCategory[] {
  const term = searchTerm.toLowerCase();
  return categories.filter(
    (c) =>
      c.display_name.toLowerCase().includes(term) ||
      c.name.toLowerCase().includes(term) ||
      c.code.toLowerCase().includes(term) ||
      c.description?.toLowerCase().includes(term)
  );
}
