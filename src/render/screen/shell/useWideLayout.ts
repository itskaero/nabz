/**
 * Which nav this screen gets.
 *
 * A media query in CSS could hide the wrong one, and the stylesheet does that
 * too as a backstop -- but hiding means BOTH navs exist in the document, which
 * is two copies of every destination in the accessibility tree and two tab
 * stops to the same place. So the decision is made here and only one is built.
 *
 * `matchMedia` is the right instrument and is missing from some environments
 * (notably the jsdom build the tests run in), so the fallback measures
 * `innerWidth` directly and listens for `resize` either way.
 */
import { useEffect, useState } from 'react';

function matches(min: number): boolean {
  try {
    if (typeof window.matchMedia === 'function') {
      return window.matchMedia(`(min-width: ${min}px)`).matches;
    }
  } catch {
    /* fall through to the measurement */
  }
  return window.innerWidth >= min;
}

/**
 * The sidebar's breakpoint. Below it there is not room for a 224px rail
 * alongside a readable column, which is the whole reason the phone gets a
 * different shape rather than a squeezed version of the same one.
 */
export const WIDE_PX = 900;

export function useWideLayout(min: number = WIDE_PX): boolean {
  const [wide, setWide] = useState(() => matches(min));

  useEffect(() => {
    const onChange = () => setWide(matches(min));
    window.addEventListener('resize', onChange);
    let mq: MediaQueryList | null = null;
    try {
      if (typeof window.matchMedia === 'function') {
        mq = window.matchMedia(`(min-width: ${min}px)`);
        mq.addEventListener('change', onChange);
      }
    } catch {
      mq = null;
    }
    // A resize between mount and this effect would otherwise stick.
    onChange();
    return () => {
      window.removeEventListener('resize', onChange);
      mq?.removeEventListener('change', onChange);
    };
  }, [min]);

  return wide;
}
