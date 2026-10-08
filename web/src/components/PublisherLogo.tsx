'use client';

import { useState } from 'react';
import { hostname, sourceMonogram } from '@/lib/format';

interface PublisherLogoProps {
  name: string;
  sourceUrl?: string | null;
  articleUrl?: string | null;
  large?: boolean;
}

/** A publisher's own favicon, with a readable fallback if it cannot be loaded. */
export function PublisherLogo({ name, sourceUrl, articleUrl, large = false }: PublisherLogoProps) {
  const [failed, setFailed] = useState(false);
  const domain = hostname(sourceUrl || articleUrl);
  const size = large ? 72 : 34;
  return (
    <span className={'publisher-logo ' + (large ? 'publisher-logo-large' : '')} title={name} aria-label={name}>
      {!failed && domain ? (
        // Publisher hosts differ; Next Image remotePatterns would be prohibitively broad.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(domain) + '&sz=' + size * 2}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="publisher-monogram" aria-hidden>{sourceMonogram(name)}</span>
      )}
    </span>
  );
}
