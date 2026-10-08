'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Moves server-rendered filter controls beside search without duplicating them in the feed. */
export function HeaderFiltersPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const slot = mounted ? document.getElementById('monitor-header-filter-slot') : null;
  return slot ? createPortal(<div className="monitor-header-filter-controls">{children}</div>, slot) : null;
}
