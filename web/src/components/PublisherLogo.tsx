'use client';

import { useEffect, useState } from 'react';
import { hostname, sourceMonogram } from '@/lib/format';

interface PublisherLogoProps {
  name: string;
  sourceUrl?: string | null;
  articleUrl?: string | null;
  large?: boolean;
}

// Remember which original-icon provider successfully loaded in this browser
// session. A transient failure never leaves a browser "broken image" glyph.
const workingIconStage = new Map<string, 0 | 1>();

export function PublisherLogo({ name, sourceUrl, articleUrl, large = false }: PublisherLogoProps) {
  const domain = hostname(sourceUrl || articleUrl);
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    setStage(workingIconStage.get(domain) ?? 0);
  }, [domain]);

  const touchIcon = domain ? 'https://' + domain + '/apple-touch-icon.png' : '';
  const favicon = domain ? 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(domain) + '&sz=128' : '';
  const src = stage === 0 ? touchIcon : favicon;
  const showImage = Boolean(domain && stage < 2);

  const imageFailed = () => {
    setReady(false);
    setStage(current => current === 0 ? 1 : 2);
  };

  return (
    <span className={'publisher-logo publisher-logo-stable ' + (large ? 'publisher-logo-large' : '')}
      title={name} aria-label={name}>
      {/* Render the fallback beneath the image from the first paint. */}
      <span className={'publisher-monogram publisher-logo-standby ' + (large ? 'publisher-sharp-wordmark' : '')}
        aria-hidden="true" style={{ opacity: ready ? 0 : 1 }}>
        {sourceMonogram(name)}
      </span>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          className="publisher-logo-asset"
          src={src}
          alt=""
          loading={large ? 'lazy' : 'eager'}
          referrerPolicy="no-referrer"
          style={{ opacity: ready ? 1 : 0 }}
          onLoad={event => {
            const image = event.currentTarget;
            const requiredSize = large ? 64 : 24;
            if (image.naturalWidth < requiredSize || image.naturalHeight < requiredSize) {
              imageFailed();
              return;
            }
            workingIconStage.set(domain, stage as 0 | 1);
            setReady(true);
          }}
          onError={imageFailed}
        />
      ) : null}
    </span>
  );
}
