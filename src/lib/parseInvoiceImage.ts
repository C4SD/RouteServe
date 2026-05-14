import Tesseract from 'tesseract.js';

export interface OCRInvoiceResult {
  invoiceNumber: string | null;
  refNumber: string | null;
  items: OCRInvoiceItem[];
}

export interface OCRInvoiceItem {
  row: number;
  description: string;
  unit_pack?: string;
  batch_number?: string;
  expiry_date?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

// Persistent worker — created once, reused across recognize calls to avoid
// the ~2s WASM re-init cost on subsequent images.
let workerPromise: Promise<Tesseract.Worker> | null = null;
// Mutable slot so we can swap the progress callback without recreating the worker.
let activeProgressCb: ((pct: number) => void) | null = null;

function getWorker(): Promise<Tesseract.Worker> {
  if (!workerPromise) {
    workerPromise = Tesseract.createWorker('eng', 1 /* OEM.LSTM_ONLY */, {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === 'recognizing text' && activeProgressCb) {
          activeProgressCb(Math.round(m.progress * 100));
        }
      },
    }).then(async (w) => {
      await w.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
      });
      return w;
    });
  }
  return workerPromise;
}

/** Call early (e.g. on component mount) to warm up the WASM worker in the background. */
export function preloadOCRWorker(): void {
  getWorker();
}

export async function ocrInvoiceImage(
  file: File,
  onProgress: (pct: number) => void
): Promise<string> {
  activeProgressCb = onProgress;
  try {
    const worker = await getWorker();
    const result = await worker.recognize(file);
    return result.data.text;
  } finally {
    activeProgressCb = null;
  }
}

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function parseExpiryDate(raw: string): string {
  const match = raw.match(/^(\d{1,2})[-/]([A-Za-z]{3})[-/](\d{2,4})$/);
  if (!match) return raw;
  const [, day, mon, year] = match;
  const monthNum = MONTH_MAP[mon.toLowerCase()];
  if (!monthNum) return raw;
  const fullYear = year.length === 2 ? `20${year}` : year;
  return `${fullYear}-${monthNum}-${day.padStart(2, '0')}`;
}

const EXPIRY_RE = /\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4}/;
const FOOTER_RE = /total\s*amount|invoice\s*total|tax\s*%/i;

export function parseInvoiceText(text: string): OCRInvoiceResult {
  const result: OCRInvoiceResult = { invoiceNumber: null, refNumber: null, items: [] };
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    if (!result.invoiceNumber) {
      const m = line.match(/Invoice\s*#\s*[:.—]?\s*(\S+)/i);
      if (m) result.invoiceNumber = m[1].replace(/[^A-Za-z0-9-]/g, '');
    }
    if (!result.refNumber) {
      const m = line.match(/Comment\s*[:.—]?\s*(\S+)/i) ?? line.match(/Ref(?:erence)?\s*[:.—]?\s*(\S+)/i);
      if (m) result.refNumber = m[1];
    }
  }

  let rowNum = 0;
  for (const line of lines) {
    if (FOOTER_RE.test(line)) break;
    const expiryMatch = line.match(EXPIRY_RE);
    if (!expiryMatch) continue;

    const expiryIdx = line.indexOf(expiryMatch[0]);
    const beforeExpiry = line.substring(0, expiryIdx).trim();
    const afterExpiry = line.substring(expiryIdx + expiryMatch[0].length).trim();

    const afterParts = afterExpiry.split(/\s+/).filter(Boolean);
    if (afterParts.length < 2) continue;

    const quantity = parseInt(afterParts[0], 10);
    const unitPrice = parseFloat(afterParts[1].replace(/[,₦]/g, ''));
    const totalPrice = afterParts.length >= 3
      ? parseFloat(afterParts[afterParts.length - 1].replace(/[,₦]/g, ''))
      : quantity * unitPrice;

    if (isNaN(quantity) || isNaN(unitPrice)) continue;

    const beforeParts = beforeExpiry.split(/\s+/).filter(Boolean);
    if (beforeParts.length < 3) continue;
    if (!/^\d+$/.test(beforeParts[0])) continue;

    const batch = beforeParts[beforeParts.length - 1];
    const packsizePart = beforeParts[beforeParts.length - 2];

    let description: string;
    let unit_pack: string | undefined;

    if (/^\d+$/.test(packsizePart)) {
      unit_pack = packsizePart;
      description = beforeParts.slice(1, beforeParts.length - 2).join(' ');
    } else {
      description = beforeParts.slice(1, beforeParts.length - 1).join(' ');
    }

    if (!description) continue;

    rowNum++;
    result.items.push({
      row: rowNum,
      description,
      unit_pack,
      batch_number: batch,
      expiry_date: parseExpiryDate(expiryMatch[0]),
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
    });
  }

  return result;
}
