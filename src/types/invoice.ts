import type { ItemCategory } from './items';

export type InvoiceStatus =
  | 'draft'
  | 'ready'
  | 'packaging_pending'
  | 'packaged'
  | 'dispatched'
  | 'completed'
  | 'cancelled';

export const INVOICE_STATUSES: InvoiceStatus[] = [
  'draft',
  'ready',
  'packaging_pending',
  'packaged',
  'dispatched',
  'completed',
  'cancelled',
];

export const INVOICE_STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800' },
  ready: { label: 'Ready', color: 'bg-blue-100 text-blue-800' },
  packaging_pending: { label: 'Packaging Pending', color: 'bg-yellow-100 text-yellow-800' },
  packaged: { label: 'Packaged', color: 'bg-purple-100 text-purple-800' },
  dispatched: { label: 'Dispatched', color: 'bg-indigo-100 text-indigo-800' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
};

export interface Invoice {
  id: string;
  invoice_number: string;
  ref_number?: string;
  requisition_id?: string;
  program?: string;
  warehouse_id: string;
  facility_id: string;
  status: InvoiceStatus;
  total_weight_kg?: number;
  total_volume_m3?: number;
  total_price: number;
  packaging_required: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;

  // Joined relations
  warehouse?: {
    id: string;
    name: string;
    code?: string;
  };
  facility?: {
    id: string;
    name: string;
    address?: string;
    lga?: string;
  };
  requisition?: {
    id: string;
    sriv_number?: string;
  };
  items?: InvoiceLineItem[];
  packaging?: InvoicePackaging;
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  item_id?: string;
  serial_number?: string;
  description: string;
  unit_pack?: string;
  category?: ItemCategory;
  weight_kg?: number;
  volume_m3?: number;
  batch_number?: string;
  mfg_date?: string;
  expiry_date?: string;
  unit_price: number;
  quantity: number;
  total_price: number;
}

export interface InvoicePackaging {
  id: string;
  invoice_id: string;
  packaging_mode: 'box' | 'bag';
  packages: PackageItem[];
  total_packages: number;
  created_at: string;
}

export interface PackageItem {
  id: string;
  packaging_id: string;
  package_type: 'box' | 'bag';
  size: 'S' | 'M' | 'L';
  package_number: number;
  weight_kg: number;
  volume_m3: number;
  items: string[]; // Array of invoice_line_item IDs
}

export interface InvoiceFilters {
  search?: string;
  status?: InvoiceStatus[];
  warehouse_id?: string;
  facility_id?: string;
  program?: string;
  date_from?: string;
  date_to?: string;
}

export interface InvoiceFormData {
  invoice_number?: string;
  ref_number?: string;
  requisition_id?: string;
  program?: string;
  warehouse_id: string;
  facility_id: string;
  notes?: string;
  items: Omit<InvoiceLineItem, 'id' | 'invoice_id'>[];
}

export type InvoiceCreationMode = 'ready_request' | 'upload_file' | 'manual_entry';
