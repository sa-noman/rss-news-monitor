# News Monitor — নিউজ মনিটরিং ও অ্যাগ্রিগেটর

১৮টি আন্তর্জাতিক সংবাদ সোর্সের RSS/Atom ফিড থেকে শিরোনাম সংগ্রহ করে, ক্যাটাগরি অনুযায়ী
সাজিয়ে Supabase-এ সংরক্ষণ করে এবং Next.js ওয়েবসাইটে (Vercel) দেখায় — সম্পূর্ণ ফ্রি টিয়ারে।

> **ডেটা নীতি:** শুধু **শিরোনাম, সংক্ষিপ্ত সারাংশ, প্রকাশের সময়, সোর্স ও মূল লিংক** সংরক্ষণ করা হয়
> (RSS-এ যা দেওয়া থাকে)। **সম্পূর্ণ আর্টিকেল কোথাও কপি বা পুনঃপ্রকাশ করা হয় না**; প্রতিটি কার্ডে
> মূল প্রকাশকের লিংক থাকে।

---

## ১. আর্কিটেকচার

```
        Cloudflare Worker  (Cron Trigger, প্রতি মিনিটে ১টি স্লট)
        ├── ৩০টি স্লটে ভাগ করা ১৮টি সোর্স → প্রতিটি সোর্স প্রতি ৩০ মিনিটে চেক
        ├── RSS 2.0 + Atom 1.0 পার্স (নির্ভরতা-মুক্ত, টলারেন্ট পার্সার)
        ├── ক্লিনিং: HTML বাদ, entity ডিকোড, তারিখ ISO-8601, লিংক absolute
        ├── কীওয়ার্ড ক্লাসিফিকেশন (ইংরেজি + বাংলা, ১৪ ক্যাটাগরি)
        └── Supabase REST upsert (link UNIQUE → ডুপ্লিকেট অসম্ভব)
                        │
                        ▼
        Supabase Postgres  (news · feed_sources · scrape_logs, RLS সহ)
        ├── anon key → শুধু পড়া যায় (ওয়েবসাইট)
        └── service_role key → শুধু Worker-এর সিক্রেট (লেখার অনুমতি)
                        │  Supabase Realtime (INSERT ব্রডকাস্ট)
                        ▼
        Next.js 16 অ্যাপ  (Vercel)
        ├── সার্ভার-সাইড রেন্ডার + ক্যাটাগরি ফিল্টার + সার্চ + পেজিনেশন
        ├── Realtime: নতুন খবর এলে "N নতুন খবর" পিল → ক্লিকে রিফ্রেশ
        └── /sources পেজ: প্রতিটি ফিডের স্বাস্থ্য ও চেক লগ
```

GitHub রিপোজিটরি → দুটি প্ল্যাটফর্মে ডিপ্লয় (Vercel: ওয়েবসাইট, Cloudflare: Worker)।

---

## ২. আজকের ভেরিফিকেশনের ফলাফল (৮ অক্টোবর ২০২৬)

| পরীক্ষা | ফলাফল |
|---|---|
| ১৭টি প্রদত্ত RSS URL লাইভ যাচাই | ১৪টি কাজ করছে, ৪টি ভাঙা/নিষ্ক্রিয় → সংশোধন করা হয়েছে (নিচে ৫ নম্বর দেখুন) |
| Worker ইউনিট টেস্ট (`npm test`) | **৭০/৭০ পাস** (পার্সিং, ক্লিনিং, ক্লাসিফিকেশন, এজ-কেস) |
| সম্পূর্ণ ফিড সেটে লাইভ রান | **১৮/১৮ সোর্স সফল**, ৯২১টি আইটেম স্ক্যান |
| ৩০-স্লট রোটেশন সিমুলেশন | ✅ ৩০ টিকে ১৮টি সোর্স, প্রতিটি **ঠিক একবার** — কোনো সোর্স বাদ পড়ে না |
| CPU বাজেট (ফ্রি প্ল্যানে ১০ms/invocation) | প্রতি invocation-এ সর্বোচ্চ **~৩.৫ms** (মাপা) — নিরাপদ মার্জিন |
| Next.js প্রোডাকশন বিল্ড | ✅ সফল (TypeScript কড়া মোডে, `tsc --noEmit` পরিষ্কার) |
| ওয়েবসাইট রেন্ডারিং | ✅ হোম / ফিল্টার / সার্চ / পেজিনেশন / /sources / /about / 404 — সব যাচাই করা |

---

## ৩. ডিরেক্টরি স্ট্রাকচার

```
news-monitor/
├── worker/                      Cloudflare Worker (মনিটরিং)
│   ├── src/
│   │   ├── index.ts             এন্ট্রি: scheduled(cron) + /run,/health এন্ডপয়েন্ট
│   │   ├── run.ts               এক রানের অর্কেস্ট্রেশন (shard/slot লজিক এখানে)
│   │   ├── rss.ts               RSS 2.0 + Atom 1.0 পার্সার (নির্ভরতা-মুক্ত)
│   │   ├── classify.ts          কীওয়ার্ড ক্যাটাগরি ক্লাসিফায়ার (ভবিষ্যতে AI যোগ করার জন্য আলাদা ফাইল)
│   │   ├── text.ts              entity/HTML/তারিখ/slug ইউটিলিটি
│   │   ├── supabase.ts          PostgREST ক্লায়েন্ট (service_role)
│   │   ├── config.ts            সোর্স তালিকা, স্লট, বাজেট, UA
│   │   └── types.ts
│   ├── test/                    ৭০টি টেস্ট + আসল ফিড fixture (১২টি) + synthetic
│   ├── scripts/dry-run.ts       ডেটাবেস ছাড়াই লাইভ ড্রাই-রান / স্লট সিমুলেশন
│   ├── scripts/bench.ts         CPU বাজেট বেঞ্চমার্ক (ফ্রি প্ল্যান প্ল্যানিং)
│   └── wrangler.toml            Cron Trigger + non-secret vars
├── web/                         Next.js 16 অ্যাপ (Vercel)
│   ├── src/app/                 page.tsx (ফিড), sources/, about/
│   ├── src/components/          NewsCard, CategoryChips, LiveUpdates (Realtime), …
│   └── src/lib/                 supabase.ts, data.ts, demo-data.ts, i18n.ts (bn/en), types.ts
├── supabase/migrations/         0001_init.sql, 0002_seed_feed_sources.sql
├── docs/
│   ├── DEPLOY.md                ধাপে ধাপে Supabase + Cloudflare + Vercel ডিপ্লয়
│   ├── FEEDS-VERIFICATION.md    ১৮টি ফিডের লাইভ-যাচাইয়ের প্রমাণ ও ৪টি সংশোধন
│   └── DECISIONS.md             নেওয়া সিদ্ধান্ত, অনুমান ও খোলা প্রশ্ন
├── .env.example                 ভ্যারিয়েবলের উদাহরণ (কোনো আসল কী নেই)
└── README.md                    এই ফাইল
```

---

## ৪. লোকালি চালানো

```bash
# ---- Worker: ডেটাবেস ছাড়াই লাইভ ড্রাই-রান (কিছু লেখা হয় না) ----
cd worker
npm install
npm run dry-run                      # সব ১৮টি ফিড একবারে --all? না, ফিড-প্রতি ৫টি আইটেম
npx tsx scripts/dry-run.ts --all-slots=30 --items=5   # ৩০ স্লটের রোটেশন সিমুলেশন
npm test                             # ৭০টি টেস্ট
npm run bench:shards                 # প্রতি স্লটে CPU বাজেট পরিমাপ

# ---- ওয়েবসাইট: env ছাড়া ডেমো ডেটায় চলে ----
cd ../web
npm install
npm run dev                          # http://localhost:3000
```

`web/.env` (বা প্ল্যাটফর্মের env) না থাকলে সাইট **ডেমো মোডে** নমুনা খবর দেখায় এবং হেডারে
"ডেমো মোড" ব্যানার দেখায় — env যোগ করলেই আসল খবর আসে।

---

## ৫. নিউজ সোর্স (১৮টি ফিড সক্রিয়)

প্রদত্ত ১৭টি URL-এর মধ্যে ৪টি আজ আর কাজ করছিল না; প্রতিটির জন্য যাচাই করা বিকল্প ব্যবহার করা
হয়েছে (বিস্তারিত প্রমাণ: `docs/FEEDS-VERIFICATION.md`):

| মূল URL | অবস্থা | গৃহীত URL |
|---|---|---|
| `aa.com.tr/en/rss/default?cat=all` | 404 | `aa.com.tr/en/rss/default?cat=live` |
| `feeds.a.dj.com/rss/RSSWorldNews.xml` | ফাইল আছে কিন্তু জানু ২০২৫ থেকে হিমশীতল | `feeds.content.dowjones.io/public/rss/RSSWorldNews` |
| `haaretz.com/srv/rss` | 404 | `haaretz.com/srv/world-news-rss` + `.../middle-east-news-rss` (২টি ফিড) |
| `politico.com/rss/politicopicks.xml` | 403 (bot-ব্লক) | `rss.politico.com/politics-news.xml` |

বাকি ১৪টি (Al Jazeera, The Atlantic, Middle East Eye, The Diplomat, NYT, The Economist,
Foreign Affairs, Financial Times, Daily Sabah, Washington Post, RFI, Drop Site News, Axios) আগের
URL-েই কাজ করছে। **Reuters, AFP, Ground News, NewsNow, Clash Report** ইচ্ছাকৃতভাবে বাদ।

একটি ফিড ব্যর্থ হলে রান থামে না — `scrape_logs`-এ ত্রুটি লেখা হয়, `/sources` পেজে দেখানো হয়,
পরের রানে আবার চেষ্টা হয়।

---

## ৬. ফ্রি টিয়ারে CPU বাজেট (গুরুত্বপূর্ণ)

Cloudflare-এর **ফ্রি প্ল্যানে প্রতি invocation-এ মাত্র ১০ms CPU** (ফিড ডাউনলোডের সময় ধরা হয় না)।
১৮টি ফিড একসাথে পার্স করলে ~৩০–৫০ms CPU লাগে — অর্থাৎ এক রানে সব ফিড চালালে রান `Error 1102`
দিয়ে ব্যর্থ হতো। তাই ডিজাইন করা হয়েছে:

* ক্রন প্রতি মিনিটে চলে (`* * * * *`), ফিড তালিকা **৩০টি স্লটে** ভাগ করা।
* `slot = floor(UTC মিনিট / ১) % ৩০` → প্রতি invocation-এ **একটি ফিড**।
* ফলে **প্রতিটি সোর্স প্রতি ৩০ মিনিটে চেক হয়** (আসল চাহিদা পূরণ), আর একটি invocation-এর CPU
  সর্বোচ্চ **~৩.৫ms** — ১০ms বাজেটে প্রায় ৩x মার্জিন।

একটি রানে সব ফিড চালাতে চাইলে (যেমন Workers Paid-এ CPU ৩০ সেকেন্ড):
`wrangler.toml`-এ `FEED_SHARDS = "1"` এবং `crons = ["*/30 * * * *"]`। ফ্রি প্ল্যানে এই মোড
CPU লিমিটে ব্যর্থ হবে — `docs/DEPLOY.md`-এ ব্যাখ্যা আছে।

---

## ৭. নিরাপত্তা নিয়ম

* `SUPABASE_SERVICE_ROLE_KEY` শুধু Worker-এর **secret** হিসেবে থাকে (`wrangler secret put`)।
  কোডে, README-তে, বা Git-এ কখনো থাকে না — `.env.example`-এ শুধু খালি উদাহরণ।
* ওয়েবসাইট শুধু **anon key** পায় (`NEXT_PUBLIC_*`), আর RLS সেই key-কে শুধু পড়ার অনুমতি দেয়।
* `news`, `feed_sources`, `scrape_logs`-এ writing পলিসি নেই — অর্থাৎ anon key দিয়ে লেখা অসম্ভব।
* কোনো কী/পাসওয়ার্ড/Tokens এই প্রজেক্টে নেই; ডিপ্লয়ে আপনি নিজে সেগুলো সেট করবেন
  (অথবা সাময়িক টোকেন দিয়ে আমাকে দিয়ে সেট করাবেন, পরে revoke করবেন)।

---

## ৮. এরপর কী

1. `docs/DEPLOY.md` ধরে Supabase → Cloudflare → Vercel ডিপ্লয়।
2. চাইলে `docs/DECISIONS.md`-এর খোলা প্রশ্নগুলোর উত্তর দিয়ে পরের ধাপ:
   বাংলা খবরের সোর্স যোগ, og:image scraping চালু, ইমেইল/টেলিগ্রাম অ্যালার্ট, AI ক্লাসিফিকেশন।
