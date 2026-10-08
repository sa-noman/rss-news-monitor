'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserClient, supabaseConfigured } from '@/lib/supabase';

type Status = 'connecting' | 'live' | 'off';

/**
 * Subscribes to Supabase Realtime INSERT events on public.news.
 * New rows are counted (never dumped mid-scroll) and a pill offers a refresh,
 * which re-renders the server component with the current filters applied.
 */
export function LiveUpdates({ labels }: { labels: { live: string; connecting: string; off: string; newStories: string; hint: string } }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(supabaseConfigured ? 'connecting' : 'off');
  const [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const supabase = getBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel('news-inserts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'news' }, () => {
        setPending((count) => Math.min(count + 1, 99));
      })
      .subscribe((state) => {
        if (state === 'SUBSCRIBED') setStatus('live');
        else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') setStatus('off');
        else setStatus('connecting');
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const refresh = () => {
    setBusy(true);
    setPending(0);
    router.refresh();
    setTimeout(() => setBusy(false), 700);
  };

  const dotColor = status === 'live' ? '#16a34a' : status === 'connecting' ? '#d97706' : 'var(--muted)';
  const statusText = status === 'live' ? labels.live : status === 'connecting' ? labels.connecting : labels.off;

  return (
    <div className="flex items-center gap-3">
      <span
        className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted"
        title={supabaseConfigured ? 'Supabase Realtime' : 'Supabase not configured'}
      >
        <span
          aria-hidden
          className={`h-2 w-2 rounded-full ${status === 'live' ? 'live-dot' : ''}`}
          style={{ background: dotColor }}
        />
        {statusText}
      </span>

      {pending > 0 ? (
        <button
          type="button"
          onClick={refresh}
          disabled={busy}
          className="slide-up flex items-center gap-2 rounded-full border border-transparent bg-accent px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <span className="tabular-nums">
            {pending} {labels.newStories}
          </span>
          <span className="hidden opacity-80 sm:inline">{labels.hint}</span>
        </button>
      ) : null}
    </div>
  );
}
