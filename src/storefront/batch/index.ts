/**
 * =====================================================
 * STOREFRONT BATCH MODULE
 * =====================================================
 *
 * Domain Owner: Storefront
 * Responsibilities:
 *   - Facility grouping into batches
 *   - Capacity validation (READ-ONLY slot demand)
 *   - Batch creation from requisitions
 *
 * MUST NOT:
 *   - Know about vehicles (beyond capacity validation)
 *   - Know about slots (beyond reading slot_snapshot)
 *   - Know about route execution
 *   - Mutate payload or slot assignments
 *
 * Batch must contain ONLY:
 *   - batch_id
 *   - route_id
 *   - facilities[]
 *   - slot_demand_per_facility (READ-ONLY)
 *   - slot_snapshot (computed once, frozen)
 */

export * from './types';
export * from './batch-builder';
export * from './capacity-validator';
export * from './facility-assembler';
