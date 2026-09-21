/**
 * One page, for the drawer the clinic already locks.
 *
 * The backup is the only copy of every record there will ever be, and it is
 * encrypted with something nobody can reset. The app's answer so far was a
 * password field and a sentence saying so, which puts the survival of a
 * practice's records on one person remembering one string under pressure.
 *
 * A clinic already has somewhere safe for paper. This is a sheet to put
 * there: the password, what it opens, and what it is worth to whoever finds
 * it. Printed rather than downloaded on purpose -- a PDF of a password in the
 * Downloads folder of the device being backed up protects nothing.
 *
 * It says the date because a sheet found in two years' time needs to say
 * whether it is still the current one, and it says the doctor's name because
 * a clinic with two doctors has two of these.
 */
import { Dialog } from './Dialog.tsx';

export function RecoverySheet({
  password,
  doctorName,
  clinicName,
  onClose,
}: {
  password: string;
  doctorName: string;
  clinicName: string;
  onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Dialog label="Backup recovery sheet" onClose={onClose}>
      <div className="sheet-modal">
        {/*
          `recovery-sheet` is what the print stylesheet keeps; everything else
          on the page is hidden when this prints. See styles.css.
        */}
        <div className="recovery-sheet">
          <h2>Nabz backup password</h2>
          <p className="recovery-who">
            {clinicName || 'This clinic'}
            {doctorName ? ` · ${doctorName}` : ''} · written {today}
          </p>

          <p className="recovery-label">The password for the backup file</p>
          <p className="recovery-code">{password}</p>

          <div className="recovery-body">
            <p>
              <strong>Keep this sheet somewhere locked, and not with the
              backup file.</strong> Anyone holding both can read every
              prescription, patient and growth record this practice has ever
              written.
            </p>
            <p>
              <strong>Nobody can reset it.</strong> Not the clinic, not the
              person who installed this, not the people who wrote it. A backup
              file without this password is a file nobody will ever open
              again.
            </p>
            <p>
              To restore: open Nabz on the new device, go to Settings, choose
              <em> Restore a backup</em>, pick the file and type the password
              above exactly as it is written — including the dashes.
            </p>
            <p className="recovery-note">
              If you change the password, print a new sheet and destroy this
              one. Old backup files still need the password they were made
              with.
            </p>
          </div>
        </div>

        <div className="actionbar" style={{ padding: '12px 0 0', borderTop: 'none' }}>
          <button className="btn quiet" onClick={onClose}>
            Close
          </button>
          <button
            className="btn"
            onClick={() => {
              /*
                Some webviews have no print at all, and jsdom throws. The sheet
                is on screen either way, which is enough to copy by hand.
              */
              try {
                window.print();
              } catch {
                /* nothing to do: the sheet is readable on screen */
              }
            }}
          >
            Print
          </button>
        </div>
      </div>
    </Dialog>
  );
}
