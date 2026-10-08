'use client';

import { useEffect, useState } from 'react';
import { hostname, sourceMonogram } from '@/lib/format';

interface PublisherLogoProps {
  name: string;
  sourceUrl?: string | null;
  articleUrl?: string | null;
  large?: boolean;
}

// Use the actual publisher domain, not an RSS redirect or feed host.
const canonicalDomains: Record<string, string> = {
  'Al Jazeera': 'aljazeera.com',
  'Anadolu Agency': 'aa.com.tr',
  'Axios': 'axios.com',
  'Daily Sabah': 'dailysabah.com',
  'Drop Site News': 'dropsitenews.com',
  'Financial Times': 'ft.com',
  'Foreign Affairs': 'foreignaffairs.com',
  'Haaretz (Middle East)': 'haaretz.com',
  'Haaretz (World)': 'haaretz.com',
  'Middle East Eye': 'middleeasteye.net',
  'POLITICO': 'politico.com',
  'RFI': 'rfi.fr',
  'The Atlantic': 'theatlantic.com',
  'The Diplomat': 'thediplomat.com',
  'The Economist': 'economist.com',
  'The New York Times': 'nytimes.com',
  'The Washington Post': 'washingtonpost.com',
  'The Wall Street Journal': 'wsj.com',
};

type Stage = 0 | 1 | 2;
// A successful source is remembered for other cards using the same publisher.
// The browser then caches the identical image URL across list/grid/sidebar.
const workingLogoStage = new Map<string, 0 | 1>();

export function PublisherLogo({ name, sourceUrl, articleUrl, large = false }: PublisherLogoProps) {
  const domain = canonicalDomains[name] ?? hostname(sourceUrl || articleUrl);
  const [stage, setStage] = useState<Stage>(() => workingLogoStage.get(domain) ?? 0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    setStage(workingLogoStage.get(domain) ?? 0);
  }, [domain]);

  // The centralized favicon endpoint is fast and browser-cacheable. Try the
  // publisher touch icon only if that single request fails or is too small.
  const favicon = domain ? 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(domain) + '&sz=128' : '';
  const touchIcon = domain ? 'https://' + domain + '/apple-touch-icon.png' : '';
  const src = stage === 0 ? favicon : touchIcon;
  const showImage = Boolean(domain && stage < 2);

  const imageFailed = () => {
    setReady(false);
    setStage(previous => previous === 0 ? 1 : 2);
  };

  return (
    <span className={'publisher-logo publisher-logo-stable ' + (large ? 'publisher-logo-large' : '')}
      title={name} aria-label={name}>
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
          decoding="async"
          referrerPolicy="no-referrer"
          style={{ opacity: ready ? 1 : 0 }}
          onLoad={event => {
            const image = event.currentTarget;
            const minimum = large ? 48 : 24;
            if (image.naturalWidth < minimum || image.naturalHeight < minimum) {
              imageFailed();
              return;
            }
            workingLogoStage.set(domain, stage as 0 | 1);
            setReady(true);
          }}
          onError={imageFailed}
        />
      ) : null}
    </span>
  );
}
