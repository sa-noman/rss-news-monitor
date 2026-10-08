import type { Metadata } from 'next';
import Link from 'next/link';
import { t } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Data policy',
  description: 'What this site collects from public RSS feeds — and what it never does.',
};

export default function AboutPage() {
  const dict = t();
  const steps = [
    {
      title: 'রান / Run',
      body: 'Cloudflare Worker Cron Trigger প্রতি ৩০ মিনিটে একবার চলে (`*/30 * * * *`)। Vercel-এ কোনো scheduled job নেই।',
    },
    {
      title: 'আনয়ন / Fetch',
      body: '১৮টি RSS/Atom ফিড সমান্তরালে পড়া হয় — প্রতি ফিডে আলাদা টাইমআউট, একবার রিট্রাই, এবং একটি ফিড ব্যর্থ হলেও বাকিগুলো চলতে থাকে।',
    },
    {
      title: 'প্রক্রিয়াকরণ / Normalize',
      body: 'শিরোনাম পরিষ্কার, HTML বাদ, তারিখ ISO-8601-এ রূপান্তর, আপেক্ষিক লিংক সম্পূর্ণ লিংকে রূপান্তর, কীওয়ার্ড দিয়ে ক্যাটাগরি নির্ধারণ (ইংরেজি + বাংলা)।',
    },
    {
      title: 'সংরক্ষণ / Store',
      body: "Supabase-এ Upsert হয় যেখানে `link` কলামে Unique Constraint আছে — একই খবর কখনো দুইবার সংরক্ষিত হয় না। সম্পূর্ণ আর্টিকেল কোথাও সংরক্ষিত হয় না।",
    },
    {
      title: 'প্রদর্শন / Display',
      body: 'Vercel-এ হোস্ট করা Next.js সাইট Supabase থেকে পড়ে দেখায়; নতুন সারি এলে Supabase Realtime দিয়ে সাথে সাথে নোটিফিকেশন আসে।',
    },
  ];

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="headline text-2xl font-bold text-ink sm:text-3xl">{dict.aboutTitle}</h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{dict.aboutBody}</p>
      </div>

      <section>
        <h2 className="headline text-xl font-semibold text-ink">{dict.aboutHow}</h2>
        <ol className="mt-3 flex flex-col gap-3">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-3 rounded-xl border border-line bg-surface p-4">
              <span className="headline text-lg font-bold text-accent tabular-nums">{index + 1}</span>
              <div>
                <p className="font-semibold text-ink">{step.title}</p>
                <p className="mt-0.5 text-[13.5px] text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="headline text-lg font-semibold text-ink">নীতিমালা / What we never do</h2>
        <ul className="mt-2 flex flex-col gap-1.5 text-[13.5px] text-muted">
          <li>• সম্পূর্ণ নিউজ আর্টিকেল কপি, সংরক্ষণ বা পুনঃপ্রকাশ করা হয় না।</li>
          <li>• প্রতিটি কার্ডে মূল প্রকাশকের লিংক থাকে; বিস্তারিত পড়তে সেখানেই যেতে হয়।</li>
          <li>• কোনো পেইড API বা API Key ব্রাউজারে পাঠানো হয় না — শুধু read-only anon key ব্যবহৃত হয় (RLS সুরক্ষিত)।</li>
          <li>• HTML স্ক্র্যাপিং বন্ধ থাকে যতক্ষণ না আলাদাভাবে অনুমতি দেওয়া হয় (শুধু og:image অপশনটি ফ্ল্যাগ দিয়ে চালু করা যায়)।</li>
          <li>• Reuters, AFP, Ground News, NewsNow, Clash Report এই সংস্করণে অন্তর্ভুক্ত নয়।</li>
        </ul>
      </section>

      <p className="text-[13.5px] text-muted">
        ফিডের স্বাস্থ্য দেখতে{' '}
        <Link href="/sources" className="font-medium text-accent hover:underline">
          {dict.sourceHealth}
        </Link>{' '}
        পেজে যান।
      </p>
    </div>
  );
}
