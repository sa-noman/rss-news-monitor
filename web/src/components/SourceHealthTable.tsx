import { fullDate, hostname, relativeTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { FeedSourceRow, ScrapeLogRow } from '@/lib/types';

function StatusChip({ status }: { status: string }) {
  const dict = t();
  const map: Record<string, { bg: string; label: string }> = {
    success: { bg: '#16a34a', label: dict.ok },
    empty: { bg: '#d97706', label: dict.empty },
    error: { bg: '#dc2626', label: dict.error },
    skipped: { bg: '#6b7280', label: dict.skipped },
  };
  const style = map[status] ?? { bg: '#6b7280', label: status };
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white"
      style={{ background: style.bg }}
    >
      {style.label}
    </span>
  );
}

export function SourceHealthTable({
  sources,
  logs,
}: {
  sources: FeedSourceRow[];
  logs: ScrapeLogRow[];
}) {
  const dict = t();
  const latestRunBySource = new Map<string, ScrapeLogRow>();
  for (const log of logs) {
    if (!log.source_name) continue;
    if (!latestRunBySource.has(log.source_name)) latestRunBySource.set(log.source_name, log);
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[860px] border-collapse text-left text-[13px]">
          <thead className="border-b border-line text-[11.5px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">{dict.source}</th>
              <th className="px-3 py-3 font-semibold">{dict.status}</th>
              <th className="px-3 py-3 font-semibold">{dict.lastChecked}</th>
              <th className="px-3 py-3 font-semibold">{dict.lastSuccess}</th>
              <th className="px-3 py-3 font-semibold text-right">{dict.itemsFound}</th>
              <th className="px-3 py-3 font-semibold text-right">{dict.itemsInserted}</th>
              <th className="px-4 py-3 font-semibold">{dict.lastError}</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => {
              const last = latestRunBySource.get(source.name);
              return (
                <tr key={source.feed_url} className="border-b border-line/70 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-ink">{source.name}</div>
                    <a
                      href={source.feed_url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="font-mono text-[11.5px] text-muted hover:text-accent"
                    >
                      {hostname(source.feed_url)}
                      {new URL(source.feed_url).pathname.slice(0, 28)}
                    </a>
                    {!source.is_active ? (
                      <span className="ml-2 rounded bg-line px-1.5 py-0.5 text-[10.5px] uppercase text-muted">
                        {dict.inactive}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    {last ? <StatusChip status={last.status} /> : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-3 py-3 text-muted" title={fullDate(source.last_checked_at)}>
                    {source.last_checked_at ? relativeTime(source.last_checked_at) : dict.never}
                  </td>
                  <td className="px-3 py-3 text-muted" title={fullDate(source.last_success_at)}>
                    {source.last_success_at ? relativeTime(source.last_success_at) : dict.never}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{last?.items_found ?? '—'}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{last?.items_inserted ?? '—'}</td>
                  <td className="max-w-[280px] px-4 py-3 text-[12px] text-muted">
                    <span className="line-clamp-2">{source.last_error ?? '—'}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3 className="mt-8 mb-3 text-[15px] font-semibold text-ink">{dict.recentRuns}</h3>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[860px] border-collapse text-left text-[13px]">
          <tbody>
            {logs.slice(0, 30).map((log) => (
              <tr key={log.id} className="border-b border-line/70 last:border-0">
                <td className="whitespace-nowrap px-4 py-2.5 text-muted" title={fullDate(log.created_at)}>
                  {relativeTime(log.created_at)}
                </td>
                <td className="px-3 py-2.5 font-medium text-ink">{log.source_name}</td>
                <td className="px-3 py-2.5">
                  <StatusChip status={log.status} />
                </td>
                <td className="px-3 py-2.5 tabular-nums text-muted">HTTP {log.http_status ?? '—'}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted">{log.items_found}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted">+{log.items_inserted}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted">{log.duration_ms ?? '—'}ms</td>
                <td className="px-4 py-2.5 text-[12px] text-muted">
                  <span className="line-clamp-1">{log.error_message ?? ''}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
