'use client';

import { useState } from 'react';
import { hostname, sourceMonogram } from '@/lib/format';

interface PublisherLogoProps {
  name: string;
  sourceUrl?: string | null;
  articleUrl?: string | null;
  large?: boolean;
}

/** Prefer high-resolution first-party touch icons instead of upscaling 16px favicons. */
export function PublisherLogo({ name, sourceUrl, articleUrl, large = false }: PublisherLogoProps) {
  const domain = hostname(sourceUrl || articleUrl);
  const [stage, setStage] = useState(0);
  const touchIcon = domain ? 'https://' + domain + '/apple-touch-icon.png' : '';
  const favicon = domain ? 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(domain) + '&sz=128' : '';
  // Small favicons look blurred when enlarged. Use a sharp text treatment
  // if no large logo exists; never pretend a generated logo is official.
  const showImage = Boolean(domain && stage < 2);
  const src = stage === 0 ? touchIcon : favicon;
  return (
    <span className={'publisher-logo ' + (large ? 'publisher-logo-large' : '')} title={name} aria-label={name}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={event => {
            if (event.currentTarget.naturalWidth < 48 || event.currentTarget.naturalHeight < 48) setStage(2);
          }}
          onError={() => setStage(large ? 2 : stage + 1)}
        />
      ) : (
        <span className={'publisher-monogram ' + (large ? 'publisher-sharp-wordmark' : '')} aria-hidden>
          {sourceMonogram(name)}
        </span>
      )}
    </span>
  );
}
