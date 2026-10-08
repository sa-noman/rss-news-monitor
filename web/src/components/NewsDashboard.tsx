'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { FeedSourceRow, NewsItem } from '@/lib/types';
import { fullDate, relativeTime } from '@/lib/format';
import { UI_LANG } from '@/lib/i18n';
import { NewsCard } from './NewsCard';
import { PublisherLogo } from './PublisherLogo';

type View = 'list' | 'grid';
const VIEW_KEY = 'news-monitor-view';
const SAVED_KEY = 'news-monitor-bookmarks-v1';

function normalizedHeadline(title: string): string {
  return title.toLocaleLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface Props {
  items: NewsItem[];
  sources: FeedSourceRow[];
  children?: ReactNode;
  focusedSource?: string;
}

/**
 * Presentation-only client state. News, pagination, and all server filters still
 * come from the existing Next.js page and Supabase query.
 */
export function NewsDashboard({ items, sources, children, focusedSource }: Props) {
  const [view, setView] = useState<View>('list');
  const [saved, setSaved] = useState<NewsItem[]>([]);
  const [savedOnly, setSavedOnly] = useState(false);
  const [selected, setSelected] = useState<NewsItem | null>(null);
  const [relatedResults, setRelatedResults] = useState<NewsItem[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedError, setRelatedError] = useState(false);
  const bn = UI_LANG === 'bn';

  useEffect(() => {
    try {
      if (window.localStorage.getItem(VIEW_KEY) === 'grid') setView('grid');
      const raw = JSON.parse(window.localStorage.getItem(SAVED_KEY) ?? '[]');
      if (Array.isArray(raw)) {
        setSaved(raw.filter((value): value is NewsItem => Boolean(value && typeof value.id === 'string' && typeof value.link === 'string' && typeof value.title === 'string')));
      }
    } catch { /* storage disabled or stale data */ }
  }, []);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(null); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selected]);

  useEffect(() => {
    if (!selected) {
      setRelatedResults([]);
      return;
    }
    const controller = new AbortController();
    setRelatedLoading(true);
    setRelatedError(false);
    setRelatedResults([]);
    fetch('/api/related?id=' + encodeURIComponent(selected.id), { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Related news unavailable');
        return response.json() as Promise<{ related: NewsItem[] }>;
      })
      .then(data => { if (!controller.signal.aborted) setRelatedResults(data.related ?? []); })
      .catch(() => { if (!controller.signal.aborted) setRelatedError(true); })
      .finally(() => { if (!controller.signal.aborted) setRelatedLoading(false); });
    return () => controller.abort();
  }, [selected]);

  const setMode = (next: View) => {
    setView(next);
    try { window.localStorage.setItem(VIEW_KEY, next); } catch { /* storage disabled */ }
  };

  const toggleBookmark = (item: NewsItem) => {
    setSaved((previous) => {
      const updated = previous.some((x) => x.id === item.id)
        ? previous.filter((x) => x.id !== item.id)
        : [item, ...previous];
      try { window.localStorage.setItem(SAVED_KEY, JSON.stringify(updated)); } catch { /* storage disabled */ }
      return updated;
    });
  };

  const visible = savedOnly ? saved : items;
  // Conservative presentation-only matching on the fetched page.
  // No cross-page or database-wide clustering is claimed.
  const relatedFor = (article: NewsItem): NewsItem[] => {
    const stopwords = new Set(['the','and','for','with','from','that','this','after','amid','over','about','says','said','into','will','have','has','are','was','were','new','news','more','than','their','its','his','her','at','in','on','of','to','a','an','as','by','or','is','us','uk']);
    const terms = (title: string) => new Set(normalizedHeadline(title).split(' ').filter(word => word.length >= 4 && !stopwords.has(word)));
    const originalTerms = terms(article.title);
    const originalDate = Date.parse(article.published_at ?? article.created_at);
    const matched = visible.filter(other => {
      if (other.source_name === article.source_name || other.id === article.id) return false;
      const comparisonDate = Date.parse(other.published_at ?? other.created_at);
      if (!Number.isFinite(originalDate) || !Number.isFinite(comparisonDate) || Math.abs(originalDate - comparisonDate) > 72 * 60 * 60 * 1000) return false;
      if (normalizedHeadline(other.title) === normalizedHeadline(article.title)) return true;
      const otherTerms = terms(other.title);
      const shared = [...originalTerms].filter(term => otherTerms.has(term)).length;
      const union = new Set([...originalTerms, ...otherTerms]).size;
      return shared >= 4 && shared / Math.max(union, 1) >= 0.65;
    });
    return [article, ...matched];
  };

  const activeSources = sources.filter((s) => s.is_active);
  const uniqueSources = activeSources.filter((s, i) => activeSources.findIndex((x) => x.name === s.name) === i)
    .sort((a, b) => (Date.parse(b.last_checked_at ?? '') || 0) - (Date.parse(a.last_checked_at ?? '') || 0));

  return (
    <section className={'monitor-dashboard ' + (view === 'grid' ? 'view-grid' : 'view-list')}>
      <div className="monitor-feed-heading">
        <div className="monitor-feed-title">
          <h2>{savedOnly ? (bn ? 'সংরক্ষিত সংবাদ' : 'Saved stories') : (bn ? 'সর্বশেষ পর্যবেক্ষণ' : 'Latest coverage')}</h2>
          <span>{savedOnly ? saved.length : items.length} {bn ? 'সংবাদ' : 'stories'}</span>
        </div>
        <div className="monitor-feed-actions">
          <button className={'saved-filter ' + (savedOnly ? 'is-active' : '')} type="button"
            aria-pressed={savedOnly} onClick={() => { setSavedOnly(!savedOnly); setSelected(null); }}>
            <svg viewBox="0 0 24 24" fill={savedOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5V21l-7-4.5L5 21z"/></svg>
            {bn ? 'বুকমার্ক' : 'Bookmarks'} {saved.length > 0 ? '(' + saved.length + ')' : ''}
          </button>
          <div className="view-switcher" role="group" aria-label="News layout">
            <button type="button" aria-pressed={view === 'list'} className={view === 'list' ? 'active' : ''} onClick={() => setMode('list')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M4 5h4v4H4zM11 6h9M4 14h4v4H4zM11 15h9"/></svg>
              {bn ? 'লিস্ট' : 'List'}
            </button>
            <button type="button" aria-pressed={view === 'grid'} className={view === 'grid' ? 'active' : ''} onClick={() => setMode('grid')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              {bn ? 'গ্রিড' : 'Grid'}
            </button>
          </div>
        </div>
      </div>

      <div className="monitor-columns">
        <div className="monitor-articles">
          {visible.length > 0 ? (
            <div className="monitor-feed">
              {visible.map((item, i) => {
                const related = relatedFor(item);
                return <NewsCard key={item.id} item={item} featured={!savedOnly && i === 0}
                  focused={Boolean(focusedSource && item.source_name === focusedSource && i === 0)}
                  bookmarked={saved.some((x) => x.id === item.id)}
                  onBookmark={toggleBookmark}
                  relatedCount={related.length}
                  onRelated={setSelected} />;
              })}
            </div>
          ) : (
            <div className="monitor-empty">
              <h3>{savedOnly ? (bn ? 'কোনো বুকমার্ক নেই' : 'No saved stories yet') : (bn ? 'কোনো সংবাদ নেই' : 'No stories found')}</h3>
              <p>{savedOnly ? (bn ? 'সংবাদের বুকমার্ক আইকন চাপুন।' : 'Bookmark articles to find them here later.') : (bn ? 'অন্য ফিল্টার ব্যবহার করুন।' : 'Try another filter.')}</p>
              {savedOnly ? <button type="button" onClick={() => setSavedOnly(false)}>{bn ? 'সব সংবাদ দেখুন' : 'View latest stories'}</button> : null}
            </div>
          )}
          {!savedOnly ? children : null}
        </div>

        <aside className="monitor-source-sidebar" aria-label={bn ? 'সোর্স মনিটরিং' : 'Source monitoring'}>
          <div className="monitor-sidebar-heading">
            <div>
              <h3>{bn ? 'সোর্স মনিটরিং' : 'Source monitoring'}</h3>
              <p>{activeSources.length} {bn ? 'সক্রিয় সোর্স' : 'active sources'}</p>
            </div>
            <Link href="/sources" aria-label="View all source status">↗</Link>
          </div>
          <div className="monitor-sidebar-list">
            {uniqueSources.slice(0, 10).map((source) => (
              <div className="monitor-sidebar-source" key={source.name}>
                {source.name.startsWith('Haaretz') ? (
                  <span className="publisher-logo" title="Haaretz" aria-label="Haaretz" style={{ position: "relative" }}>
                    {/* Wikimedia Commons hosts Haaretz's square 2023 logo in vector format. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="https://commons.wikimedia.org/wiki/Special:Redirect/file/Logo_Haaretz_2023_blue.svg"
                      alt="Haaretz" loading="lazy" referrerPolicy="no-referrer" style={{ position: "relative", zIndex: 1 }}
                      onError={event => { event.currentTarget.style.display = "none"; }} />
                    <span className="publisher-monogram" aria-hidden="true" style={{ position: "absolute", zIndex: 0 }}>H</span>
                  </span>
                ) : source.name === 'Middle East Eye' ? (
                  <span className="publisher-logo" title="Middle East Eye" aria-label="Middle East Eye" style={{ position: 'relative', background: '#422364', color: '#fff' }}>
                    <span aria-hidden="true" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1 }}>MEE</span>
                  </span>
                ) : (
                  <PublisherLogo name={source.name} sourceUrl={source.website_url ?? source.feed_url} />
                )}
                <div className="monitor-sidebar-source-text">
                  <Link className="monitor-source-jump" title={'Jump to latest '+source.name+' story'} href={'/?source=' + encodeURIComponent(source.name) + '&focus=latest#latest-source-story'}>{source.name}</Link>
                  <small>{source.last_checked_at ? (bn ? 'চেক ' : 'Checked ') + relativeTime(source.last_checked_at) : (bn ? 'সক্রিয় ফিড' : 'Active feed')}</small>
                </div>
                <span className="monitor-source-active" title={bn ? 'সক্রিয়' : 'Active'} />
              </div>
            ))}
          </div>
          <Link href="/sources" className="monitor-all-sources">{bn ? 'সব সোর্সের অবস্থা দেখুন' : 'View all source health'} →</Link>
          <div className="monitor-sidebar-note">
            <strong>{bn ? 'মনিটরিং' : 'Monitoring'}</strong>
            <span>{bn ? 'সর্বশেষ সংবাদ ও সোর্সের অবস্থা' : 'Latest headlines and source status'}</span>
          </div>
        </aside>
      </div>

      {selected ? (
        <div className="coverage-backdrop" onClick={() => setSelected(null)}>
          <aside className="coverage-drawer" role="dialog" aria-modal="true" aria-label={bn ? 'একই সংবাদের সোর্স' : 'Related coverage'} onClick={(event) => event.stopPropagation()}>
            <div className="coverage-drawer-top">
              <div>
                <span className="coverage-kicker">{bn ? 'একই শিরোনামের প্রতিবেদন' : 'Matching reports'}</span>
                <h3>Related News</h3>
              </div>
              <button className="coverage-close" onClick={() => setSelected(null)} aria-label="Close panel">×</button>
            </div>
            <h4 className="coverage-story-title">{selected.title}</h4>
            <div className="coverage-source-count">{relatedLoading ? 'Searching other publishers…' : relatedResults.length + ' related reports'}</div>
            <div className="coverage-reports">
              {!relatedLoading && !relatedError && relatedResults.length === 0 ? <p className="coverage-no-matches">No related news found</p> : null}
              {relatedError ? <p className="coverage-no-matches">Could not check related news right now.</p> : null}
              {relatedResults.map((article) => (
                <a key={article.id} href={article.link} target="_blank" rel="noopener noreferrer nofollow" className="coverage-report">
                  <PublisherLogo name={article.source_name} sourceUrl={article.source_url} articleUrl={article.link} />
                  <div><strong>{article.source_name}</strong><time dateTime={article.published_at ?? article.created_at} title={fullDate(article.published_at ?? article.created_at)}>{relativeTime(article.published_at ?? article.created_at)}</time><p>{article.title}</p></div>
                  <span aria-hidden>↗</span>
                </a>
              ))}
            </div>
            <p className="coverage-disclaimer">{bn ? 'শুধু এই পাতায় লোড হওয়া সংবাদের মধ্যে সতর্কতার সঙ্গে শিরোনাম মিলিয়ে দেখানো হয়েছে।' : 'Matches are checked against other publishers in the database within a 72-hour window. Similarity matching may not find every report.'}</p>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
