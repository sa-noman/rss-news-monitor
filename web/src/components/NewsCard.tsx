'use client';

import { useEffect, useRef, useState } from 'react';
import { categoryColor, fullDate, relativeTime } from '@/lib/format';
import { categoryLabel, t } from '@/lib/i18n';
import type { NewsItem } from '@/lib/types';
import { PublisherLogo } from './PublisherLogo';

export interface MonitorCardProps {
  item: NewsItem;
  featured?: boolean;
  bookmarked?: boolean;
  relatedCount?: number;
  onBookmark?: (item: NewsItem) => void;
  onRelated?: (item: NewsItem) => void;
}

export function NewsCard({
  item, featured = false, bookmarked = false, relatedCount = 0, onBookmark, onRelated,
}: MonitorCardProps) {
  const [brokenImage, setBrokenImage] = useState(false);
  const [foundImage, setFoundImage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => { setBrokenImage(false); setFoundImage(null); setVisible(false); }, [item.id]);
  const mediaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (item.image_url) return;
    const media = mediaRef.current;
    if (!media) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, {rootMargin:'140px'});
    observer.observe(media);
    return () => observer.disconnect();
  }, [item.id, item.image_url]);
  useEffect(() => {
    if (!visible || item.image_url || !/^[0-9a-f-]{36}$/i.test(item.id)) return;
    const controller = new AbortController();
    fetch('/api/article-image?id=' + encodeURIComponent(item.id), {signal:controller.signal})
      .then(res => res.ok ? res.json() as Promise<{image:string|null}> : {image:null})
      .then(data => {if (!controller.signal.aborted && data.image) setFoundImage(data.image);})
      .catch(() => {});
    return () => controller.abort();
  }, [visible,item.id,item.image_url]);
  const dict = t();
  const color = categoryColor(item.category);
  const publishDate = item.published_at ?? item.created_at;
  const timeText = relativeTime(publishDate);
  // Always prefer the original image already collected from RSS.
  // Only request a missing photo from the publisher when RSS supplied none.
  const resolvedImage = (item.image_url?.trim() || foundImage) ?? null;
  const imageAvailable = Boolean(resolvedImage && !brokenImage);

  return (
    <article className={'monitor-card card ' + (featured ? 'monitor-featured ' : '')}>
      <div ref={mediaRef} className="monitor-media" style={{ backgroundColor: color + '17' }}>
        {imageAvailable ? (
          <a href={item.link} target="_blank" rel="noopener noreferrer nofollow" className="monitor-image-link" aria-label={item.title}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={resolvedImage} className="monitor-photo" src={resolvedImage!} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBrokenImage(true)} />
          </a>
        ) : (
          <a href={item.link} target="_blank" rel="noopener noreferrer nofollow" className="monitor-logo-fallback" aria-label={item.title}>
            <PublisherLogo name={item.source_name} sourceUrl={item.source_url} articleUrl={item.link} large />
            <span>{item.source_name}</span>
          </a>
        )}
        <span className="monitor-category" style={{ backgroundColor: color }}>
          {categoryLabel(item.category)}
        </span>
        {onBookmark ? (
          <button className={'bookmark-button ' + (bookmarked ? 'is-bookmarked' : '')}
            type="button" onClick={() => onBookmark(item)}
            aria-pressed={bookmarked} aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark article'}
            title={bookmarked ? 'Remove bookmark' : 'Bookmark article'}>
            <svg viewBox="0 0 24 24" fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5V21l-7-4.5L5 21z" />
            </svg>
          </button>
        ) : null}
      </div>

      <div className="monitor-card-content">
        <h2 className="monitor-title headline">
          <a href={item.link} target="_blank" rel="noopener noreferrer nofollow">{item.title}</a>
        </h2>
        {item.summary ? <p className="monitor-summary">{item.summary}</p> : null}

        <div className="monitor-card-footer">
          <div className="monitor-source-line">
            <PublisherLogo name={item.source_name} sourceUrl={item.source_url} articleUrl={item.link} />
            <div className="monitor-source-meta">
              <span className="monitor-source-name">{item.source_name}</span>
              <time dateTime={publishDate} title={fullDate(publishDate)}>{timeText}</time>
            </div>
          </div>
          <div className="monitor-card-actions">
            {onRelated ? (
              <button type="button" className="related-trigger" onClick={() => onRelated(item)}
                aria-label="Open Related News">
                Related News{relatedCount > 1 ? ' · ' + (relatedCount - 1) : ''}
              </button>
            ) : null}
            <a className="monitor-read-link" href={item.link} target="_blank" rel="noopener noreferrer nofollow">
              {dict.readAtSource} ↗
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
