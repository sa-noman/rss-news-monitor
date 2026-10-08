'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UI_LANG } from '@/lib/i18n';

interface Props { date?: string; from?: string; to?: string; }
export function DateFilter({ date, from, to }: Props) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(date ?? 'all');
  const [custom, setCustom] = useState(date === 'custom');
  const [start, setStart] = useState(from ?? '');
  const [end, setEnd] = useState(to ?? '');
  const bn = UI_LANG === 'bn';

  const go = (value: string, fromDate = '', toDate = '') => {
    const params = new URLSearchParams(window.location.search);
    params.delete('date'); params.delete('from'); params.delete('to'); params.delete('page');
    if (value && value !== 'all') params.set('date', value);
    if (value === 'custom') {
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
    }
    router.push('/?' + params.toString());
  };

  return (
    <div className="date-filter">
      <label className="sr-only" htmlFor="news-date-filter">{bn ? 'প্রকাশের তারিখ' : 'Published date'}</label>
      <select
        id="news-date-filter"
        className="monitor-select"
        value={selectedDate}
        onChange={(event) => {
          const value = event.target.value;
          setSelectedDate(value);
          setCustom(value === 'custom');
          if (value !== 'custom') go(value);
        }}
      >
        <option value="all">{bn ? 'সব তারিখ' : 'All dates'}</option>
        <option value="today">{bn ? 'আজ' : 'Today'}</option>
        <option value="yesterday">{bn ? 'গতকাল' : 'Yesterday'}</option>
        <option value="7d">{bn ? 'গত ৭ দিন' : 'Last 7 days'}</option>
        <option value="30d">{bn ? 'গত ৩০ দিন' : 'Last 30 days'}</option>
        <option value="custom">{bn ? 'নির্দিষ্ট সময়' : 'Custom range'}</option>
      </select>
      {custom ? (
        <form className="custom-range" onSubmit={(event) => { event.preventDefault(); go('custom', start, end); }}>
          <input aria-label="From date" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <input aria-label="To date" type="date" min={start || undefined} value={end} onChange={(e) => setEnd(e.target.value)} />
          <button type="submit" disabled={(!start && !end) || (Boolean(start && end) && start > end)}>{bn ? 'প্রয়োগ' : 'Apply'}</button>
        </form>
      ) : null}
    </div>
  );
}
