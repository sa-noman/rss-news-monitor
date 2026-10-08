import { t } from '@/lib/i18n';

/** Shown when Supabase env vars are missing or a live query failed. */
export function ModeBanner({ error }: { error?: string }) {
  const dict = t();
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[13px] text-ink">
      <p className="font-semibold">{dict.demoModeTitle}</p>
      <p className="text-muted">{dict.demoModeBody}</p>
      {error ? <p className="mt-1 font-mono text-[11.5px] text-muted">Supabase: {error}</p> : null}
    </div>
  );
}
