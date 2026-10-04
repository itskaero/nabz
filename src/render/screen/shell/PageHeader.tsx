/**
 * Where you are, and what this screen is.
 *
 * WHAT WAS MISSING. Every destination in this app began with a card. The
 * Patients screen opened on a card called "Patients", the builder opened on a
 * bar, a module opened on its panel — so the window had a title only in the
 * sense that one of the boxes happened to have a heading in it. There was
 * nothing that said where you were, and nothing to hang a screen-level action
 * on except the card it belonged to.
 *
 * Both reference layouts answer this the same way and it is worth copying
 * exactly: a breadcrumb above a real page title, with the screen's actions on
 * the right of the same line. It costs one row and it is the row that makes a
 * window feel like an application rather than a stack of panels.
 *
 * The trail is a TRAIL, not a link path. This app has no router — nothing here
 * is clickable except the crumb that leads back, and that one is passed in as
 * a callback rather than as a href.
 */
import type { ReactNode } from 'react';

export interface PageHeaderProps {
  /** the quiet crumbs before the title, outermost first */
  trail?: string[];
  title: string;
  /** one line under the title, when the screen needs explaining */
  lede?: string | undefined;
  /** the screen's own actions, on the right of the title line */
  actions?: ReactNode;
  /** rendered under the lede: stats, filters, a month strip */
  children?: ReactNode;
}

export function PageHeader({ trail, title, lede, actions, children }: PageHeaderProps) {
  return (
    <header className="page-head">
      {trail && trail.length > 0 && (
        <nav className="crumbs" aria-label="Breadcrumb">
          {trail.map((crumb) => (
            <span key={crumb}>
              {crumb}
              <span className="crumb-sep" aria-hidden="true">
                ›
              </span>
            </span>
          ))}
          {/*
            `aria-hidden`, because the h1 immediately below says the same
            thing. The reference layouts end the trail with the current page
            and then repeat it as the title, which looks right and reads
            twice — a screen reader announces the page name, then the trail
            ending in the page name, then the heading with the page name.
            Keeping it visual-only costs nothing and removes two of those.
          */}
          <span className="crumb-here" aria-hidden="true">
            {title}
          </span>
        </nav>
      )}
      <div className="page-title-row">
        <h1 className="page-title">{title}</h1>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
      {lede && <p className="page-lede">{lede}</p>}
      {children}
    </header>
  );
}

/**
 * A figure, what it is, and which way it is going.
 *
 * The shape both references use for the row across the top of a screen: a
 * small uppercase label, the number large and in mono, a line of context, a
 * hairline, and a footer that says what changed. The mono is not decoration —
 * in this product it means "a precise value", which is the same rule the dose
 * figures follow.
 *
 * `delta` is deliberately a string rather than a number with a sign: "2 this
 * week" and "none yet" are as useful as "+12%", and a component that can only
 * render a percentage forces every screen to invent one.
 */
export interface StatProps {
  label: string;
  value: ReactNode;
  /** under the number: what it counts */
  of?: string | undefined;
  /** the footer line, when there is one */
  foot?: string | undefined;
  delta?: string | undefined;
  /** 'up' and 'down' colour the delta; 'flat' leaves it quiet */
  trend?: 'up' | 'down' | 'flat' | undefined;
}

export function Stat({ label, value, of, foot, delta, trend = 'flat' }: StatProps) {
  return (
    <div className="statcard">
      <span className="stat-lab">{label}</span>
      <span className="statcard-num">{value}</span>
      {of && <span className="statcard-of">{of}</span>}
      {(foot || delta) && (
        <div className="statcard-foot">
          <span>{foot}</span>
          {delta && (
            <span className="statcard-delta" data-trend={trend}>
              {trend === 'up' ? '▲ ' : trend === 'down' ? '▼ ' : ''}
              {delta}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
