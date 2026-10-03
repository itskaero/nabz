/**
 * Imaging: the study, its report, and the photographs of the film.
 *
 * WHY THE BINARIES ARE NOT IN THE RECORDS BACKUP
 * ----------------------------------------------
 * `exportEncrypted` builds ONE JSON file:
 *
 *     btoa(base64(ciphertext(JSON.stringify(payload))))
 *
 * That is three full copies of everything in memory at once -- the JSON
 * string, the ciphertext, and the base64 of it -- plus the Blob. Text
 * encounters are kilobytes and it does not matter. One photograph of a chest
 * film is megabytes, and five hundred patients with two images each would run
 * the tab out of memory long before it wrote a file. The failure would land on
 * a doctor pressing Back up, which is the worst moment to discover it.
 *
 * So the study metadata and the report text ride in the records backup like
 * any other clinical text, and the IMAGES live in their own store with their
 * own export. The checklist says so in as many words rather than leaving it
 * as a footnote: "images are not in your records backup" is a fact a doctor
 * has to know before they need it.
 *
 * WHY THE IMAGES ARE DOWNSCALED
 * -----------------------------
 * A phone camera's 12-megapixel original of a printed X-ray is not a clinical
 * gain -- the information ceiling is the film and the room light, not the
 * sensor -- and it is a storage disaster on a device with no server behind it.
 * The long edge is capped and the result re-encoded as JPEG.
 */

export type Modality = 'X-ray' | 'Ultrasound' | 'CT' | 'MRI' | 'Echo' | 'Other';

export const MODALITIES: Modality[] = ['X-ray', 'Ultrasound', 'CT', 'MRI', 'Echo', 'Other'];

export interface ImagingStudy {
  id: string;
  patientId: string;
  /** the encounter that ordered it, when it is known */
  encounterId?: string;
  modality: Modality;
  /** "chest", "right knee", "abdomen and pelvis" */
  region: string;
  /** ISO date the study was done */
  performedOn: string;
  /** the radiologist's report, or the doctor's own reading. Free text. */
  report?: string;
  /** where it was done, when that matters for comparison */
  facility?: string;
  attachmentIds: string[];
  enteredOn: string;
}

/**
 * One stored image.
 *
 * `blob` is the only field in this app that is not text, and it is the reason
 * `attachments` is excluded from `collectBackup`.
 */
export interface Attachment {
  id: string;
  patientId: string;
  studyId: string;
  mime: string;
  /** byte length, so a storage summary never has to read the blob */
  bytes: number;
  blob: Blob;
  /** longest edge after downscaling, recorded so a later pass knows */
  longEdge: number;
  addedOn: string;
}

/** The cap. A printed film photographed at 1600px reads at full screen. */
export const MAX_LONG_EDGE = 1600;
export const JPEG_QUALITY = 0.82;

export function studyLabel(study: ImagingStudy): string {
  return `${study.modality} — ${study.region}`;
}

/** Newest first, which is the order a comparison is read in. */
export function sortStudies(studies: ImagingStudy[]): ImagingStudy[] {
  return [...studies].sort((a, b) => b.performedOn.localeCompare(a.performedOn));
}

export function totalBytes(attachments: Array<{ bytes: number }>): number {
  return attachments.reduce((n, a) => n + a.bytes, 0);
}

/** "2.4 MB". Plain, because a doctor deciding whether to keep an image is not reading bytes. */
export function humanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The target dimensions for a downscale, or null when the image is already
 * small enough to keep as it is.
 *
 * Separated from the canvas work so the arithmetic is testable: an image that
 * comes out the wrong shape is a chest film that no longer matches the ribs.
 */
export function downscaleTo(
  width: number,
  height: number,
  maxLongEdge = MAX_LONG_EDGE,
): { width: number; height: number } | null {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) return null;
  const scale = maxLongEdge / longEdge;
  return {
    // Round, then floor at 1: a 4000x3 panorama must not become 1600x0.
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
