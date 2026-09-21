/**
 * @vitest-environment jsdom
 *
 * The banner stack, collapsed.
 *
 * Four amber bars could stack above the working area at once, which on a 390px
 * phone is up to 136px spent on conditions that have all been true since the
 * app opened. Worse, four amber bars read as wallpaper: the day one of them
 * matters it looks exactly like the three that do not.
 *
 * What these hold is the line between collapsing and hiding. The summary is
 * only worth it when there is more than one thing; the content has to stay
 * one tap away; and the two notices that must NOT be folded in -- the allergy
 * alert, and a font that is merely loading -- have to stay out.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusNotices } from '@render/screen/shell/StatusNotices.tsx';
import type { Notice } from '@render/screen/shell/StatusNotices.tsx';

afterEach(cleanup);

const notice = (id: string, over: Partial<Notice> = {}): Notice => ({
  id,
  title: `${id} happened.`,
  body: `something about ${id}`,
  ...over,
});

describe('one thing', () => {
  it('is said outright, not hidden behind a count', () => {
    // "1 thing needs attention [Show]" is a tap to read one sentence.
    render(<StatusNotices notices={[notice('backup')]} />);
    expect(screen.getByRole('status').textContent).toContain('backup happened.');
    expect(screen.queryByRole('button', { name: /things need attention/ })).toBeNull();
  });

  it('keeps its action reachable without a tap to reveal it', () => {
    let ran = false;
    render(
      <StatusNotices
        notices={[notice('backup', { action: { label: 'Export now', run: () => (ran = true) } })]}
      />,
    );
    screen.getByRole('button', { name: 'Export now' }).click();
    expect(ran).toBe(true);
  });
});

describe('two or more', () => {
  const two = [notice('insecure'), notice('rejected')];

  it('collapses to a count', () => {
    render(<StatusNotices notices={two} />);
    const summary = screen.getByRole('button', { name: /things need attention/ });
    expect(summary.textContent).toContain('2 things need attention');
    expect(screen.getByRole('status').textContent).not.toContain('insecure happened.');
  });

  it('gives all of it back on one tap, with the actions intact', async () => {
    let ran = false;
    render(
      <StatusNotices
        notices={[
          notice('insecure'),
          notice('rejected', {
            action: { label: 'Open builder', run: () => (ran = true) },
          }),
        ]}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /things need attention/ }));
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('insecure happened.');
    expect(status.textContent).toContain('rejected happened.');
    await userEvent.click(screen.getByRole('button', { name: 'Open builder' }));
    expect(ran).toBe(true);
  });

  it('says whether it is open, so a screen reader is not guessing', async () => {
    render(<StatusNotices notices={two} />);
    const summary = screen.getByRole('button', { name: /things need attention/ });
    expect(summary.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(summary);
    expect(summary.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('progress is not attention', () => {
  it('never joins the count', () => {
    // "2 things need attention" about a font that is downloading itself is a
    // lie with a button on it.
    render(
      <StatusNotices
        notices={[notice('fonts', { tone: 'progress' }), notice('rejected')]}
      />,
    );
    expect(screen.queryByRole('button', { name: /things need attention/ })).toBeNull();
    const said = screen.getAllByRole('status').map((s) => s.textContent).join(' ');
    expect(said).toContain('fonts happened.');
    expect(said).toContain('rejected happened.');
  });

  it('keeps its own line rather than a warning colour', () => {
    render(<StatusNotices notices={[notice('fonts', { tone: 'progress' })]} />);
    const banner = screen.getByRole('status');
    // Amber means "not vetted" in this app; a font that is still downloading
    // is not unvetted, it is loading.
    expect(banner.className).toContain('banner-progress');
    expect(banner.className).not.toContain('banner-backup');
  });
});

describe('nothing at all', () => {
  it('renders nothing, rather than an empty bar', () => {
    const { container } = render(<StatusNotices notices={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
