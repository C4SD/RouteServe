/**
 * VLMS Vehicle Onboarding - State Management
 * Zustand store for managing onboarding wizard state
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  OnboardingStep,
  OnboardingState,
  VehicleCategory,
  VehicleType,
  CapacityConfig,
  VehicleRegistrationData,
  VehicleOnboardingFormData,
} from '@/types/vlms-onboarding';
import { createCapacityConfigFromDefaults } from '@/lib/vlms/capacityCalculations';

// =====================================================
// INITIAL STATES
// =====================================================

const initialCapacityConfig: CapacityConfig = {
  capacity_kg: 1000,
  capacity_m3: 4.5,
  tiered_config: [],
  use_dimensions: false,
};

const initialRegistrationData: VehicleRegistrationData = {
  make: '',
  model: '',
  year: new Date().getFullYear(),
  license_plate: '',
  acquisition_date: new Date().toISOString().split('T')[0],
  acquisition_type: 'purchase',
  status: 'available',
  current_mileage: 0,
};

const initialState: OnboardingState = {
  currentStep: 'category',
  selectedCategory: null,
  selectedType: null,
  customTypeName: '',
  capacityConfig: initialCapacityConfig,
  registrationData: initialRegistrationData,
  isLoading: false,
  errors: {},
};

// =====================================================
// STORE INTERFACE
// =====================================================

interface OnboardingActions {
  // Navigation
  setCurrentStep: (step: OnboardingStep) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  canGoNext: () => boolean;
  canGoBack: () => boolean;

  // Category selection (Step 1)
  setSelectedCategory: (category: VehicleCategory | null) => void;

  // Type selection (Step 2)
  setSelectedType: (type: VehicleType | null) => void;
  setCustomTypeName: (name: string) => void;

  // Capacity configuration (Step 3)
  setCapacityConfig: (config: CapacityConfig) => void;
  updateCapacityConfig: (updates: Partial<CapacityConfig>) => void;

  // Registration data (Step 4)
  setRegistrationData: (data: VehicleRegistrationData) => void;
  updateRegistrationData: (updates: Partial<VehicleRegistrationData>) => void;

  // Loading & errors
  setLoading: (loading: boolean) => void;
  setError: (field: string, message: string) => void;
  clearError: (field: string) => void;
  clearAllErrors: () => void;

  // Form assembly
  getFormData: () => VehicleOnboardingFormData | null;

  // Reset
  reset: () => void;
}

// =====================================================
// STORE DEFINITION
// =====================================================

export const useVehicleOnboardState = create<OnboardingState & OnboardingActions>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // =====================================================
      // NAVIGATION
      // =====================================================

      setCurrentStep: (step) => {
        set({ currentStep: step }, false, 'setCurrentStep');
      },

      goToNextStep: () => {
        const { currentStep } = get();
        const steps: OnboardingStep[] = ['category', 'type', 'capacity', 'registration', 'review'];
        const currentIndex = steps.indexOf(currentStep);

        if (currentIndex < steps.length - 1) {
          set({ currentStep: steps[currentIndex + 1] }, false, 'goToNextStep');
        }
      },

      goToPreviousStep: () => {
        const { currentStep } = get();
        const steps: OnboardingStep[] = ['category', 'type', 'capacity', 'registration', 'review'];
        const currentIndex = steps.indexOf(currentStep);

        if (currentIndex > 0) {
          set({ currentStep: steps[currentIndex - 1] }, false, 'goToPreviousStep');
        }
      },

      canGoNext: () => {
        const { currentStep, selectedCategory, selectedType, customTypeName, registrationData } =
          get();

        switch (currentStep) {
          case 'category':
            return selectedCategory !== null;

          case 'type':
            return selectedType !== null || customTypeName.trim().length > 0;

          case 'capacity':
            return true; // Capacity is optional

          case 'registration':
            return (
              registrationData.make.trim().length > 0 &&
              registrationData.model.trim().length > 0 &&
              registrationData.license_plate.trim().length > 0 &&
              registrationData.year > 1900 &&
              registrationData.year <= new Date().getFullYear() + 1
            );

          case 'review':
            return false; // Can't go next from review

          default:
            return false;
        }
      },

      canGoBack: () => {
        const { currentStep } = get();
        return currentStep !== 'category';
      },

      // =====================================================
      // CATEGORY SELECTION
      // =====================================================

      setSelectedCategory: (category) => {
        set(
          {
            selectedCategory: category,
            // Reset subsequent steps when category changes
            selectedType: null,
            customTypeName: '',
            capacityConfig: initialCapacityConfig,
          },
          false,
          'setSelectedCategory'
        );
      },

      // =====================================================
      // TYPE SELECTION
      // =====================================================

      setSelectedType: (type) => {
        // When a type is selected, populate capacity config with defaults
        const newCapacityConfig = type
          ? createCapacityConfigFromDefaults(
              type.default_capacity_kg,
              type.default_capacity_m3,
              type.default_tier_config
            )
          : initialCapacityConfig;

        set(
          {
            selectedType: type,
            customTypeName: '', // Clear custom name when selecting a type
            capacityConfig: newCapacityConfig,
          },
          false,
          'setSelectedType'
        );
      },

      setCustomTypeName: (name) => {
        set(
          {
            customTypeName: name,
            selectedType: null, // Clear selected type when entering custom name
          },
          false,
          'setCustomTypeName'
        );
      },

      // =====================================================
      // CAPACITY CONFIGURATION
      // =====================================================

      setCapacityConfig: (config) => {
        set({ capacityConfig: config }, false, 'setCapacityConfig');
      },

      updateCapacityConfig: (updates) => {
        const { capacityConfig } = get();
        set(
          {
            capacityConfig: {
              ...capacityConfig,
              ...updates,
            },
          },
          false,
          'updateCapacityConfig'
        );
      },

      // =====================================================
      // REGISTRATION DATA
      // =====================================================

      setRegistrationData: (data) => {
        set({ registrationData: data }, false, 'setRegistrationData');
      },

      updateRegistrationData: (updates) => {
        const { registrationData } = get();
        set(
          {
            registrationData: {
              ...registrationData,
              ...updates,
            },
          },
          false,
          'updateRegistrationData'
        );
      },

      // =====================================================
      // LOADING & ERRORS
      // =====================================================

      setLoading: (loading) => {
        set({ isLoading: loading }, false, 'setLoading');
      },

      setError: (field, message) => {
        const { errors } = get();
        set(
          {
            errors: {
              ...errors,
              [field]: message,
            },
          },
          false,
          'setError'
        );
      },

      clearError: (field) => {
        const { errors } = get();
        const newErrors = { ...errors };
        delete newErrors[field];
        set({ errors: newErrors }, false, 'clearError');
      },

      clearAllErrors: () => {
        set({ errors: {} }, false, 'clearAllErrors');
      },

      // =====================================================
      // FORM ASSEMBLY
      // =====================================================

      getFormData: (): VehicleOnboardingFormData | null => {
        const {
          selectedCategory,
          selectedType,
          customTypeName,
          capacityConfig,
          registrationData,
        } = get();

        if (!selectedCategory) {
          return null;
        }

        // Build the form data
        // Note: category_id and vehicle_type_id are DB UUID FKs — the static taxonomy
        // uses non-UUID string IDs (e.g. 'cat-passenger'), so we omit them here.
        // The type/category info is captured in the `type` text field below.
        const formData: VehicleOnboardingFormData = {
          // Taxonomy — leave FK fields undefined (nullable in DB)
          category_id: undefined as any,
          vehicle_type_id: undefined,

          // Registration data
          ...registrationData,

          // Capacity
          capacity_kg: capacityConfig.capacity_kg,
          capacity_m3: capacityConfig.capacity_m3,
          vehicle_length_cm: capacityConfig.vehicle_dimensions?.length_cm,
          vehicle_width_cm: capacityConfig.vehicle_dimensions?.width_cm,
          vehicle_height_cm: capacityConfig.vehicle_dimensions?.height_cm,
          length_cm: capacityConfig.dimensions?.length_cm,
          width_cm: capacityConfig.dimensions?.width_cm,
          height_cm: capacityConfig.dimensions?.height_cm,
          tiered_config: capacityConfig.tiered_config,

          // Required fields for vehicles table — use category code for correct silhouette mapping
          type: selectedType?.code || selectedCategory?.code || 'van',
          plate_number: registrationData.license_plate, // Sync with license_plate
          capacity: capacityConfig.capacity_m3 || 10, // Default 10 m³
          max_weight: capacityConfig.capacity_kg || 1000, // Default 1000 kg
          fuel_type: registrationData.fuel_type || 'diesel', // Use selected or default
          fuel_efficiency: 10.0, // Default L/100km
          status: 'available', // Default status
        };

        return formData;
      },

      // =====================================================
      // RESET
      // =====================================================

      reset: () => {
        set(initialState, false, 'reset');
      },
    }),
    { name: 'VehicleOnboardingStore' }
  )
);

// =====================================================
// SELECTORS (for optimized re-renders)
// =====================================================

export const selectCurrentStep = (state: OnboardingState & OnboardingActions) =>
  state.currentStep;

export const selectSelectedCategory = (state: OnboardingState & OnboardingActions) =>
  state.selectedCategory;

export const selectSelectedType = (state: OnboardingState & OnboardingActions) =>
  state.selectedType;

export const selectCapacityConfig = (state: OnboardingState & OnboardingActions) =>
  state.capacityConfig;

export const selectRegistrationData = (state: OnboardingState & OnboardingActions) =>
  state.registrationData;

export const selectCanGoNext = (state: OnboardingState & OnboardingActions) => state.canGoNext();

export const selectCanGoBack = (state: OnboardingState & OnboardingActions) => state.canGoBack();

export const selectIsLoading = (state: OnboardingState & OnboardingActions) => state.isLoading;

export const selectErrors = (state: OnboardingState & OnboardingActions) => state.errors;

// =====================================================
// HELPER HOOKS (using selectors)
// =====================================================

export function useOnboardingStep() {
  return useVehicleOnboardState(selectCurrentStep);
}

export function useSelectedCategory() {
  return useVehicleOnboardState(selectSelectedCategory);
}

export function useSelectedType() {
  return useVehicleOnboardState(selectSelectedType);
}

export function useCapacityConfig() {
  return useVehicleOnboardState(selectCapacityConfig);
}

export function useRegistrationData() {
  return useVehicleOnboardState(selectRegistrationData);
}

export function useOnboardingNavigation() {
  const canGoNext = useVehicleOnboardState(selectCanGoNext);
  const canGoBack = useVehicleOnboardState(selectCanGoBack);
  const goToNextStep = useVehicleOnboardState((state) => state.goToNextStep);
  const goToPreviousStep = useVehicleOnboardState((state) => state.goToPreviousStep);
  const setCurrentStep = useVehicleOnboardState((state) => state.setCurrentStep);

  return {
    canGoNext,
    canGoBack,
    goToNextStep,
    goToPreviousStep,
    setCurrentStep,
  };
}
