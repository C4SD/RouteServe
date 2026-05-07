/**
 * Pure diff utility for smart import.
 * Compares uploaded rows against existing DB records to classify each as:
 *   - new (no match found)
 *   - update (match found, at least one field differs)
 *   - duplicate (match found, all comparable fields identical)
 *
 * All inputs use raw DB snake_case field names (not TS camelCase type aliases).
 * No side effects, no hooks, no Supabase calls — safe to run in any context.
 */

import { similarityScore } from './fuzzy-match';

// ─── Core types ──────────────────────────────────────────────────────────────

export type DbRow = Record<string, unknown>;

export type MatchConfidence = 'exact_key' | 'fuzzy_name';

export type FieldDiffKind =
  | 'enrichment'   // DB is null/empty, upload has value → safe to apply
  | 'conflict'     // Both have values but they differ → upload wins on confirm
  | 'unchanged';

export interface FieldDiff {
  field: string;
  dbValue: unknown;
  uploadValue: unknown;
  kind: FieldDiffKind;
}

export interface DiffRecord {
  uploadRow: DbRow;
  dbRecord: DbRow;
  dbId: string;
  matchConfidence: MatchConfidence;
  /** Only enrichment and conflict entries (unchanged filtered out) */
  fieldDiffs: FieldDiff[];
}

export interface ImportDiffResult {
  newRecords: DbRow[];
  updateRecords: DiffRecord[];
  duplicateRecords: DiffRecord[];
}

// ─── Field comparison ─────────────────────────────────────────────────────────

function isEmpty(val: unknown): boolean {
  return val === null || val === undefined || val === '';
}

function normalizeValue(val: unknown): string {
  if (isEmpty(val)) return '';
  if (Array.isArray(val)) return [...val].map(String).sort().join(',');
  return String(val).trim().toLowerCase();
}

function classifyField(dbVal: unknown, uploadVal: unknown, field: string): FieldDiffKind {
  if (isEmpty(uploadVal)) return 'unchanged';
  if (isEmpty(dbVal)) return 'enrichment';

  // lat/lng: 0.0001° tolerance (~11 m) to absorb floating-point rounding
  if (field === 'lat' || field === 'lng') {
    const db = Number(dbVal);
    const up = Number(uploadVal);
    if (!isNaN(db) && !isNaN(up) && Math.abs(db - up) <= 0.0001) return 'unchanged';
  }

  return normalizeValue(dbVal) === normalizeValue(uploadVal) ? 'unchanged' : 'conflict';
}

function computeFieldDiffs(
  dbRecord: DbRow,
  uploadRow: DbRow,
  comparableFields: string[],
): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  for (const field of comparableFields) {
    const kind = classifyField(dbRecord[field], uploadRow[field], field);
    if (kind !== 'unchanged') {
      diffs.push({ field, dbValue: dbRecord[field], uploadValue: uploadRow[field], kind });
    }
  }
  return diffs;
}

// ─── Shared diff engine ───────────────────────────────────────────────────────

function computeDiff(
  uploadedRows: DbRow[],
  existingRecords: DbRow[],
  keyField: string,
  nameField: string,
  comparableFields: string[],
  fuzzyThreshold: number,
): ImportDiffResult {
  // Build lookup maps
  const byKey = new Map<string, DbRow>();
  const byName = new Map<string, DbRow>();
  for (const rec of existingRecords) {
    const key = rec[keyField];
    if (key) byKey.set(String(key).trim().toLowerCase(), rec);
    const name = rec[nameField];
    if (name) byName.set(String(name).trim().toLowerCase(), rec);
  }

  const result: ImportDiffResult = {
    newRecords: [],
    updateRecords: [],
    duplicateRecords: [],
  };

  for (const row of uploadedRows) {
    let match: DbRow | undefined;
    let confidence: MatchConfidence = 'exact_key';

    // 1. Primary: key field exact match
    const rowKey = row[keyField];
    if (rowKey) {
      match = byKey.get(String(rowKey).trim().toLowerCase());
    }

    // 2. Fallback: name-based matching
    if (!match) {
      const rowName = row[nameField];
      if (rowName) {
        const normalizedName = String(rowName).trim().toLowerCase();
        // Try exact name first (fast path)
        match = byName.get(normalizedName);
        if (match) {
          confidence = 'exact_key';
        } else if (fuzzyThreshold < 1.0) {
          // Fuzzy scan (only for facilities, not items)
          let bestScore = 0;
          for (const rec of existingRecords) {
            const recName = rec[nameField];
            if (!recName) continue;
            const score = similarityScore(
              normalizedName,
              String(recName).trim().toLowerCase(),
              fuzzyThreshold,
            );
            if (score >= fuzzyThreshold && score > bestScore) {
              bestScore = score;
              match = rec;
              confidence = 'fuzzy_name';
            }
          }
        }
      }
    }

    if (!match) {
      result.newRecords.push(row);
      continue;
    }

    const fieldDiffs = computeFieldDiffs(match, row, comparableFields);
    const diffRecord: DiffRecord = {
      uploadRow: row,
      dbRecord: match,
      dbId: String(match['id']),
      matchConfidence: confidence,
      fieldDiffs,
    };

    if (fieldDiffs.length === 0) {
      result.duplicateRecords.push(diffRecord);
    } else {
      result.updateRecords.push(diffRecord);
    }
  }

  return result;
}

// ─── Facility diff ────────────────────────────────────────────────────────────

const FACILITY_COMPARABLE_FIELDS = [
  'name', 'address', 'lat', 'lng', 'type', 'phone', 'contact_person',
  'capacity', 'operating_hours', 'warehouse_code', 'state', 'ip_name',
  'funding_source', 'programme', 'pcr_service', 'cd4_service',
  'type_of_service', 'service_zone', 'level_of_care', 'lga', 'ward',
  'contact_name_pharmacy', 'designation', 'phone_pharmacy', 'email',
  'storage_capacity', 'zone_id',
];

/**
 * Both uploadedRows and existingFacilities must be in raw DB snake_case format.
 * uploadedRows: output of buildDbFacility() in EnhancedCSVImportDialog
 * existingFacilities: raw DB rows from useAllFacilitiesForDiff()
 */
export function computeFacilityDiff(
  uploadedRows: DbRow[],
  existingFacilities: DbRow[],
): ImportDiffResult {
  return computeDiff(uploadedRows, existingFacilities, 'warehouse_code', 'name', FACILITY_COMPARABLE_FIELDS, 0.80);
}

// ─── Item diff ────────────────────────────────────────────────────────────────

const ITEM_COMPARABLE_FIELDS = [
  'description', 'unit_pack', 'category', 'program',
  'weight_kg', 'volume_m3', 'batch_number', 'mfg_date', 'expiry_date',
  'store_address', 'lot_number', 'stock_on_hand', 'unit_price', 'warehouse_id',
];

/**
 * Both must be in raw DB snake_case.
 * uploadedRows: items ready to insert (serial_number, description, etc.)
 * existingItems: raw DB rows from useAllItemsForDiff()
 */
export function computeItemDiff(
  uploadedRows: DbRow[],
  existingItems: DbRow[],
): ImportDiffResult {
  // Items use 1.0 threshold (exact description match, no fuzzy)
  return computeDiff(uploadedRows, existingItems, 'serial_number', 'description', ITEM_COMPARABLE_FIELDS, 1.0);
}

// ─── Program Item diff ────────────────────────────────────────────────────────

const PROGRAM_ITEM_COMPARABLE_FIELDS = [
  'description', 'unit_pack', 'category', 'stock_on_hand', 'unit_price',
  'batch_number', 'expiry_date', 'lot_number', 'weight_kg', 'volume_m3',
];

/**
 * Program items also write to the `items` table with program = program.code.
 * Key field: serial_number (= product_code in the upload file)
 * Name field: description (= item_name in the upload file)
 */
export function computeProgramItemDiff(
  uploadedRows: DbRow[],
  existingItems: DbRow[],
): ImportDiffResult {
  return computeDiff(uploadedRows, existingItems, 'serial_number', 'description', PROGRAM_ITEM_COMPARABLE_FIELDS, 1.0);
}
