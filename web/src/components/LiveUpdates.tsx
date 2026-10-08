'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserClient, supabaseConfigured } from '@/lib/supabase';

type Status = 'connecting' | 'live' | 'off';

/** Existing Supabase Realtime functionality, with dot-only visual status. */
export function LiveUpdates({ labels }: { labels: {
  live: string; connecting: string; off: string; newStories: string; hint: string;
} }) {
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
    return () => { void supabase.removeChannel(channel); };
  }, []);

  const refresh = () => {
    setBusy(true);
    setPending(0);
    router.refresh();
    setTimeout(() => setBusy(false), 700);
  };
  const statusText = status === 'live' ? labels.live : status === 'connecting' ? labels.connecting : labels.off;

  return (
    <div className="monitor-realtime">
      <span role="status" aria-label={statusText} title={statusText}
        className={'monitor-live-indicator monitor-live-' + status}>
        <span className="monitor-live-circle" aria-hidden />
        <span className="sr-only">{statusText}</span>
      </span>
      {pending > 0 ? (
        <button type="button" onClick={refresh} disabled={busy}
          className="monitor-new-pill slide-up">
          {pending} {labels.newStories}
          <span className="hidden sm:inline"> · {labels.hint}</span>
        </button>
      ) : null}
    </div>
  );
}
