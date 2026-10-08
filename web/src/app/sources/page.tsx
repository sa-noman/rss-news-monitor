import type { Metadata } from 'next';
import { ModeBanner } from '@/components/ModeBanner';
import { SourceHealthTable } from '@/components/SourceHealthTable';
import { fetchRecentLogs, fetchSources } from '@/lib/data';
import { relativeTime } from '@/lib/format';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Source monitoring',
  description: 'Live health of every monitored RSS feed: last check, last success, items found and errors.',
};

export default async function SourcesPage() {
  const dict = t();
  const [sourcesResult, logsResult] = await Promise.all([fetchSources(), fetchRecentLogs(60)]);
  const { sources, mode, error } = sourcesResult;
  const logs = logsResult.logs;

  const active = sources.filter((s) => s.is_active);
  const failing = sources.filter((s) => s.last_error);
  const lastChecked = sources
    .map((s) => s.last_checked_at)
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1);
  const successRate = (() => {
    const runIds = [...new Set(logs.map((l) => l.run_id))].slice(0, 1)[0];
    const runLogs = logs.filter((l) => l.run_id === runIds);
    if (runLogs.length === 0) return null;
    const ok = runLogs.filter((l) => l.status === 'success' || l.status === 'empty').length;
    return Math.round((ok / runLogs.length) * 100);
  })();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="headline text-2xl font-bold text-ink sm:text-3xl">{dict.sourceHealth}</h1>
        <p className="mt-1 max-w-3xl text-[14px] text-muted">{dict.sourceHealthIntro}</p>
      </div>

      {mode === 'demo' ? <ModeBanner error={error} /> : null}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={dict.source} value={`${active.length}/${sources.length}`} hint={dict.active} />
        <Stat label={dict.status} value={successRate === null ? '—' : `${successRate}%`} hint="last run" />
        <Stat label={dict.lastChecked} value={lastChecked ? relativeTime(lastChecked) : dict.never} />
        <Stat label={dict.error} value={String(failing.length)} hint={failing.length === 1 ? 'feed' : 'feeds'} />
      </dl>

      <SourceHealthTable sources={sources} logs={logs} />
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <dt className="text-[11.5px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className="headline mt-0.5 text-xl font-bold text-ink">
        {value}
        {hint ? <span className="ml-1 text-[12px] font-medium text-muted">{hint}</span> : null}
      </dd>
    </div>
  );
}
