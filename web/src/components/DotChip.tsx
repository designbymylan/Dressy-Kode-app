import type { ReactNode } from 'react';

/** Une petite ligne à point : un mot ou deux (un type de rendez-vous, une indication du jour). */
export const DotChip = ({ children }: { children: ReactNode }) => (
  <span className="dot-chip"><i aria-hidden="true" />{children}</span>
);
