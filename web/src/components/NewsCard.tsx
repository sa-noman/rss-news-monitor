'use client';

import { useState } from 'react';
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
  const dict = t();
  const color = categoryColor(item.category);
  const publishDate = item.published_at ?? item.created_at;
  const timeText = relativeTime(publishDate);
  const imageAvailable = Boolean(item.image_url && !brokenImage);

  return (
    <article className={'monitor-card card ' + (featured ? 'monitor-featured ' : '')}>
      <div className="monitor-media" style={{ backgroundColor: color + '17' }}>
        {imageAvailable ? (
          <a href={item.link} target="_blank" rel="noopener noreferrer nofollow" className="monitor-image-link" aria-label={item.title}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="monitor-photo" src={item.image_url!} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBrokenImage(true)} />
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
          {relatedCount > 1 && onRelated ? (
            <button type="button" className="related-trigger" onClick={() => onRelated(item)}
              aria-label={'View ' + relatedCount + ' sources covering this story'}>
              <span aria-hidden>▤</span> {relatedCount} sources
            </button>
          ) : (
            <a className="monitor-read-link" href={item.link} target="_blank" rel="noopener noreferrer nofollow">
              {dict.readAtSource} ↗
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
