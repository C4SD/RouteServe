import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface FilterState {
  // Delivery filters
  deliveryStatus: string;
  deliveryPriority: string;

  // Vehicle filters
  vehicleStatus: string;
  vehicleType: string;

  // Driver filters
  driverStatus: string;

  // Facility filters
  facilityType: string;
  facilityRegion: string;

  // Actions
  setDeliveryStatus: (status: string) => void;
  setDeliveryPriority: (priority: string) => void;
  setVehicleStatus: (status: string) => void;
  setVehicleType: (type: string) => void;
  setDriverStatus: (status: string) => void;
  setFacilityType: (type: string) => void;
  setFacilityRegion: (region: string) => void;
  resetFilters: () => void;
}

const initialState = {
  deliveryStatus: 'all',
  deliveryPriority: 'all',
  vehicleStatus: 'all',
  vehicleType: 'all',
  driverStatus: 'all',
  facilityType: 'all',
  facilityRegion: 'all',
};

/**
 * Persisted filter store
 * Saves user's filter preferences to localStorage
 */
export const useFiltersStore = create<FilterState>()(
  persist(
    (set) => ({
      ...initialState,

      setDeliveryStatus: (status) => set({ deliveryStatus: status }),
      setDeliveryPriority: (priority) => set({ deliveryPriority: priority }),
      setVehicleStatus: (status) => set({ vehicleStatus: status }),
      setVehicleType: (type) => set({ vehicleType: type }),
      setDriverStatus: (status) => set({ driverStatus: status }),
      setFacilityType: (type) => set({ facilityType: type }),
      setFacilityRegion: (region) => set({ facilityRegion: region }),

      resetFilters: () => set(initialState),
    }),
    {
      name: 'routeserve-filters-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist filter values, not actions
      partialize: (state) => ({
        deliveryStatus: state.deliveryStatus,
        deliveryPriority: state.deliveryPriority,
        vehicleStatus: state.vehicleStatus,
        vehicleType: state.vehicleType,
        driverStatus: state.driverStatus,
        facilityType: state.facilityType,
        facilityRegion: state.facilityRegion,
      }),
    }
  )
);
