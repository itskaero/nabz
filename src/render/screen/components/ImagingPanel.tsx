/**
 * Imaging: studies, their reports, and photographs of the film.
 *
 * Two things here are not obvious.
 *
 * THE DOWNSCALE HAPPENS ON ADD, not on display. A phone camera's 12-megapixel
 * original of a printed X-ray is not a clinical gain -- the information ceiling
 * is the film and the room light, not the sensor -- and it is a storage
 * disaster on a device with no server behind it. Resizing at display time
 * would leave the original on disk forever, which is the thing that actually
 * fills a phone.
 *
 * THE OBJECT URLS ARE REVOKED. A blob URL holds its blob alive until it is
 * revoked, so a doctor scrolling through a hundred thumbnails without this
 * would hold a hundred decoded images in memory and the tab would be killed by
 * the browser rather than by anything in the code.
 */
import { useEffect, useMemo, useState } from 'react';
import type { Attachment, ImagingStudy, Modality } from '@domain/imaging.ts';
import {
  JPEG_QUALITY,
  MAX_LONG_EDGE,
  MODALITIES,
  downscaleTo,
  humanBytes,
  sortStudies,
  studyLabel,
  totalBytes,
} from '@domain/imaging.ts';

/**
 * Read a file, downscale it if it is bigger than the cap, and hand back a JPEG.
 *
 * Returns the original untouched when it is already small enough: re-encoding
 * a 900px image as JPEG only loses detail to no purpose.
 */
async function prepareImage(file: File): Promise<{ blob: Blob; longEdge: number }> {
  const bitmap = await createImageBitmap(file);
  try {
    const target = downscaleTo(bitmap.width, bitmap.height, MAX_LONG_EDGE);
    if (!target) {
      return { blob: file, longEdge: Math.max(bitmap.width, bitmap.height) };
    }
    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { blob: file, longEdge: Math.max(bitmap.width, bitmap.height) };
    ctx.drawImage(bitmap, 0, 0, target.width, target.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    );
    return blob
      ? { blob, longEdge: Math.max(target.width, target.height) }
      : { blob: file, longEdge: Math.max(bitmap.width, bitmap.height) };
  } finally {
    bitmap.close();
  }
}

export function ImagingPanel({
  patientId,
  studies,
  attachments,
  onAddStudy,
  onDeleteStudy,
  onAddImage,
  onDeleteImage,
}: {
  patientId: string;
  studies: ImagingStudy[];
  attachments: Attachment[];
  onAddStudy: (study: Omit<ImagingStudy, 'id' | 'enteredOn' | 'attachmentIds'>) => void;
  onDeleteStudy: (id: string) => void;
  onAddImage: (studyId: string, blob: Blob, longEdge: number) => void;
  onDeleteImage: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const ordered = sortStudies(studies);

  return (
    <section className="card">
      <h2>Imaging</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        {attachments.length === 0
          ? 'Photograph the film, or record the report on its own.'
          : `${attachments.length} image${attachments.length === 1 ? '' : 's'}, ${humanBytes(totalBytes(attachments))}. These are not in your records backup — they have their own file.`}
      </p>

      {ordered.length === 0 && <p className="empty">No imaging recorded.</p>}

      {ordered.map((study) => (
        <StudyBlock
          key={study.id}
          study={study}
          images={attachments.filter((a) => a.studyId === study.id)}
          onDelete={() => onDeleteStudy(study.id)}
          onAddImage={(blob, longEdge) => onAddImage(study.id, blob, longEdge)}
          onDeleteImage={onDeleteImage}
        />
      ))}

      {adding ? (
        <AddStudy
          patientId={patientId}
          onCancel={() => setAdding(false)}
          onAdd={(s) => {
            onAddStudy(s);
            setAdding(false);
          }}
        />
      ) : (
        <div className="actionbar" style={{ padding: '12px 0 0', borderTop: 'none' }}>
          <button className="btn ghost" onClick={() => setAdding(true)}>
            Record a study
          </button>
        </div>
      )}
    </section>
  );
}

function StudyBlock({
  study,
  images,
  onDelete,
  onAddImage,
  onDeleteImage,
}: {
  study: ImagingStudy;
  images: Attachment[];
  onDelete: () => void;
  onAddImage: (blob: Blob, longEdge: number) => void;
  onDeleteImage: (id: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // One URL per blob, revoked together when the set changes or the component
  // unmounts. Without this a hundred thumbnails hold a hundred decoded images.
  const urls = useMemo(() => images.map((a) => ({ id: a.id, url: URL.createObjectURL(a.blob) })), [images]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u.url)), [urls]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const { blob, longEdge } = await prepareImage(file);
      onAddImage(blob, longEdge);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="study">
      <div className="study-head">
        <div style={{ minWidth: 0 }}>
          <span className="fact-label">{studyLabel(study)}</span>
          <div className="meta">
            {study.performedOn}
            {study.facility ? ` · ${study.facility}` : ''}
          </div>
        </div>
        <button className="mini" aria-label={`Remove ${studyLabel(study)}`} onClick={onDelete}>
          ✕
        </button>
      </div>

      {study.report && <p className="study-report">{study.report}</p>}

      {urls.length > 0 && (
        <div className="thumbs">
          {urls.map(({ id, url }) => (
            <button
              key={id}
              className="thumb"
              aria-label="Open image"
              onClick={() => setOpen(open === id ? null : id)}
            >
              <img src={url} alt="" />
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="image-open">
          <img src={urls.find((u) => u.id === open)?.url} alt={studyLabel(study)} />
          <div className="actionbar" style={{ padding: '8px 0 0', borderTop: 'none' }}>
            <button className="btn quiet" onClick={() => setOpen(null)}>
              Close
            </button>
            <button
              className="btn danger"
              onClick={() => {
                onDeleteImage(open);
                setOpen(null);
              }}
            >
              Delete this image
            </button>
          </div>
        </div>
      )}

      <label className="btn ghost add-image">
        {busy ? 'Resizing…' : 'Add a photograph'}
        <input
          type="file"
          accept="image/*"
          aria-label="Add a photograph"
          disabled={busy}
          style={{ display: 'none' }}
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </label>
    </div>
  );
}

function AddStudy({
  patientId,
  onAdd,
  onCancel,
}: {
  patientId: string;
  onAdd: (study: Omit<ImagingStudy, 'id' | 'enteredOn' | 'attachmentIds'>) => void;
  onCancel: () => void;
}) {
  const [modality, setModality] = useState<Modality>('X-ray');
  const [region, setRegion] = useState('');
  const [performedOn, setPerformedOn] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState('');
  const [facility, setFacility] = useState('');

  return (
    <div className="lab-add">
      <div className="opt-group">
        <label>Modality</label>
        <div className="opts">
          {MODALITIES.map((m) => (
            <button key={m} className="opt" aria-pressed={modality === m} onClick={() => setModality(m)}>
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className="two-col" style={{ marginTop: 8 }}>
        <div className="field">
          <label htmlFor="img-region">Region</label>
          <input
            id="img-region"
            value={region}
            placeholder="chest, right knee…"
            onChange={(e) => setRegion(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="img-date">Performed on</label>
          <input
            id="img-date"
            type="date"
            value={performedOn}
            onChange={(e) => setPerformedOn(e.target.value)}
          />
        </div>
      </div>
      <div className="field" style={{ marginTop: 8 }}>
        <label htmlFor="img-facility">Where</label>
        <input
          id="img-facility"
          value={facility}
          placeholder="which laboratory or hospital"
          onChange={(e) => setFacility(e.target.value)}
        />
      </div>
      <div className="field" style={{ marginTop: 8 }}>
        <label htmlFor="img-report">Report</label>
        <textarea
          id="img-report"
          rows={3}
          value={report}
          placeholder="the radiologist’s report, or your own reading"
          onChange={(e) => setReport(e.target.value)}
        />
      </div>
      <div className="actionbar" style={{ padding: '10px 0 0', borderTop: 'none' }}>
        <button className="btn quiet" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn"
          disabled={!region.trim()}
          onClick={() =>
            onAdd({
              patientId,
              modality,
              region: region.trim(),
              performedOn,
              ...(report.trim() ? { report: report.trim() } : {}),
              ...(facility.trim() ? { facility: facility.trim() } : {}),
            })
          }
        >
          Save the study
        </button>
      </div>
    </div>
  );
}
