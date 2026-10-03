/**
 * Imaging, and the split that makes it possible.
 *
 * The test that matters here is the one asserting the records backup does NOT
 * contain the pictures. `exportEncrypted` holds three copies of its payload in
 * memory on the way to a file; text encounters are kilobytes and photographs
 * are megabytes, so a single file would die on a doctor pressing Back up.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { downscaleTo, humanBytes, sortStudies, totalBytes } from '@domain/imaging.ts';
import type { Attachment, ImagingStudy } from '@domain/imaging.ts';
import { collectBackup, importBackup } from '@storage/backup.ts';
import { exportImages, importImages, peekImageBundle } from '@storage/imagingBackup.ts';
import * as db from '@storage/db.ts';

const PID = 'p-img';
const PASSWORD = 'a-long-enough-password';

/** A tiny but real PNG, so the blob round-trip is a byte comparison. */
const PIXELS = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4, 5, 6, 7, 8]);

function study(id: string, performedOn: string): ImagingStudy {
  return {
    id,
    patientId: PID,
    modality: 'X-ray',
    region: 'chest',
    performedOn,
    report: 'Right lower zone consolidation.',
    attachmentIds: [],
    enteredOn: `${performedOn}T10:00:00.000Z`,
  };
}

function image(id: string, studyId: string): Attachment {
  return {
    id,
    patientId: PID,
    studyId,
    mime: 'image/png',
    bytes: PIXELS.byteLength,
    blob: new Blob([PIXELS], { type: 'image/png' }),
    longEdge: 1600,
    addedOn: '2026-09-20T10:00:00.000Z',
  };
}

async function wipe(): Promise<void> {
  const database = await db.db();
  for (const s of ['imagingStudies', 'attachments', 'prescriptions', 'patients'] as const) {
    await database.clear(s);
  }
}

describe('downscaling', () => {
  it('leaves an image that is already small enough alone', () => {
    expect(downscaleTo(900, 600, 1600)).toBeNull();
  });

  it('keeps the shape, which is the whole point on a chest film', () => {
    const out = downscaleTo(4000, 3000, 1600)!;
    expect(out).toEqual({ width: 1600, height: 1200 });
    expect(out.width / out.height).toBeCloseTo(4 / 3, 5);
  });

  it('caps the LONG edge whichever way round the photograph is', () => {
    expect(downscaleTo(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it('never produces a zero-height image', () => {
    // A 4000x3 panorama must not become 1600x0, which would be a canvas that
    // throws rather than an image that looks wrong.
    expect(downscaleTo(4000, 3, 1600)).toEqual({ width: 1600, height: 1 });
  });
});

describe('sizes', () => {
  it('adds up without reading a single blob', () => {
    expect(totalBytes([{ bytes: 1000 }, { bytes: 2000 }])).toBe(3000);
  });

  it('says MB to a doctor and not bytes', () => {
    expect(humanBytes(900)).toBe('900 B');
    expect(humanBytes(2048)).toBe('2 KB');
    expect(humanBytes(2_621_440)).toBe('2.5 MB');
  });

  it('reads newest first, which is how a comparison is read', () => {
    const out = sortStudies([study('a', '2026-01-02'), study('b', '2026-09-20')]);
    expect(out.map((s) => s.id)).toEqual(['b', 'a']);
  });
});

describe('the split backup', () => {
  beforeEach(async () => {
    await wipe();
    await db.savePatient({
      id: PID,
      name: 'Hassan Raza',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await db.saveImagingStudy(study('s1', '2026-09-20'));
    await db.saveAttachment(image('a1', 's1'));
    await db.saveAttachment(image('a2', 's1'));
  });

  it('carries the study and the report in the records backup', async () => {
    const payload = await collectBackup(false);
    expect(payload.imagingStudies?.map((s) => s.id)).toEqual(['s1']);
    expect(payload.imagingStudies?.[0]?.report).toMatch(/consolidation/);
  });

  it('DOES NOT carry the images — the test this whole design exists for', async () => {
    const payload = await collectBackup(false);
    // Not in the payload under any key, and not reachable by serialising it:
    // a Blob would come out as {} and the file would be a lie, but a string
    // search is the check that cannot be fooled by a field rename.
    expect('attachments' in payload).toBe(false);
    const json = JSON.stringify(payload);
    expect(json).not.toContain('"blob"');
    expect(json).not.toContain('a1');
    // And the whole payload stays small, which is the property that matters.
    expect(json.length).toBeLessThan(4000);
  });

  it('round-trips the images through their own file, under the same password', async () => {
    const blob = await exportImages(PASSWORD);
    const text = await blob.text();

    const header = peekImageBundle(text)!;
    expect(header.count).toBe(2);
    // Line-delimited, so a restore can take it one image at a time.
    expect(text.trim().split('\n')).toHaveLength(3);

    const database = await db.db();
    await database.clear('attachments');
    expect(await db.attachmentsForStudy('s1')).toHaveLength(0);

    const summary = await importImages(text, PASSWORD, 'merge');
    expect(summary.restored).toBe(2);

    const back = await db.attachmentsForStudy('s1');
    expect(back).toHaveLength(2);
    expect(new Uint8Array(await back[0]!.blob.arrayBuffer())).toEqual(PIXELS);
  });

  it('refuses a wrong password instead of producing plausible pixels', async () => {
    const text = await (await exportImages(PASSWORD)).text();
    await (await db.db()).clear('attachments');
    await expect(importImages(text, 'a-different-password')).rejects.toThrow(/Wrong password/);
  });

  it('refuses a file that is not an image bundle', async () => {
    await expect(importImages('{"magic":"SOMETHING-ELSE"}\n', PASSWORD)).rejects.toThrow(
      /not a Nabz image backup/,
    );
    expect(peekImageBundle('not json at all')).toBeNull();
  });

  it('never lets a records restore delete the only copy of an X-ray', async () => {
    const payload = await collectBackup(false);
    // `replace` is the destructive mode and it still must not touch the
    // images: they live in a different file, so a records restore has no
    // business deciding they are stale.
    await importBackup(payload, 'replace');
    expect(await db.attachmentsForStudy('s1')).toHaveLength(2);
  });

  it('skips an image already on this device rather than overwriting it', async () => {
    const text = await (await exportImages(PASSWORD)).text();
    const summary = await importImages(text, PASSWORD, 'merge');
    expect(summary).toEqual({ restored: 0, skipped: 2 });
  });

  it('takes the images with the study, so no blob is left unreachable', async () => {
    await db.deleteImagingStudy('s1');
    expect(await db.attachmentsForStudy('s1')).toHaveLength(0);
    expect(await db.attachmentsForPatient(PID)).toHaveLength(0);
  });

  it('refuses to store an image on a reception station', async () => {
    const { setDeviceRole, clearDeviceRole, ReceptionDeviceError } = await import(
      '@domain/deviceRole.ts'
    );
    setDeviceRole('reception');
    try {
      await expect(db.saveAttachment(image('a9', 's1'))).rejects.toThrow(ReceptionDeviceError);
      await expect(db.saveImagingStudy(study('s9', '2026-09-21'))).rejects.toThrow(
        ReceptionDeviceError,
      );
    } finally {
      clearDeviceRole();
    }
  });
});
