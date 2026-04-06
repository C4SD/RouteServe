/**
 * Hooks to check uniqueness of license plate and VIN against the vehicles table.
 * Debounced to avoid spamming the DB on every keystroke.
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const DEBOUNCE_MS = 600;

function useFieldUniqueness(
  dbColumn: 'license_plate' | 'vin',
  value: string,
  minLength: number,
  excludeId?: string,
): { isDuplicate: boolean; isChecking: boolean } {
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const trimmed = value.trim();
    if (!trimmed || trimmed.length < minLength) {
      setIsDuplicate(false);
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    const timer = setTimeout(async () => {
      try {
        const workspaceId = localStorage.getItem('biko_active_workspace_id');
        let query = (supabase as any)
          .from('vehicles')
          .select('id')
          .eq(dbColumn, trimmed)
          .limit(1);

        if (workspaceId) {
          query = query.eq('workspace_id', workspaceId);
        }
        if (excludeId) {
          query = query.neq('id', excludeId);
        }

        const { data } = await query;
        setIsDuplicate((data?.length ?? 0) > 0);
      } catch {
        setIsDuplicate(false);
      } finally {
        setIsChecking(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [dbColumn, value, minLength, excludeId]);

  return { isDuplicate, isChecking };
}

/** Check whether a license plate is already registered in this workspace. */
export function useLicensePlateUniqueness(plate: string, excludeId?: string) {
  return useFieldUniqueness('license_plate', plate, 3, excludeId);
}

/** Check whether a VIN is already registered in this workspace. */
export function useVinUniqueness(vin: string, excludeId?: string) {
  return useFieldUniqueness('vin', vin, 17, excludeId);
}
