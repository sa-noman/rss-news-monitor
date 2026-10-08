# DEPLOY.md — ধাপে ধাপে ডিপ্লয় (সম্পূর্ণ ফ্রি টিয়ার)

তিনটি অংশ: **A) Supabase → B) Cloudflare Worker → C) Vercel**। প্রতিটি ধাপের শেষে একটি
ভেরিফিকেশন আছে — সেটি না মিললে পরের ধাপে যাবেন না।

> আপনি চাইলে পুরো প্রক্রিয়াটি আমি চালিয়ে দিতে পারি, তবে এর জন্য প্রয়োজন হবে:
> **Supabase** → Project URL + anon key + service_role key; **Cloudflare** → Account ID + API Token
> (Workers Scripts: Edit) ; **Vercel** → Vercel Token অথবা আপনি নিজে GitHub থেকে import করবেন।
> যেকোনো কী দিলে কাজ শেষে **revoke/rotate** করে নিন। আমি কোনো কী কোডে বা Git-এ লিখব না।

---

## A. Supabase (ডেটাবেস)

1. **প্রজেক্ট তৈরি** — https://supabase.com/dashboard → *New project*
   - Name: `news-monitor`, Region: **Southeast Asia (Singapore)** (বাংলাদেশ/সিঙ্গাপুর থেকে দ্রুত),
     Database Password: শক্ত পাসওয়ার্ড (নিরাপদ জায়গায় রাখুন — কোডে লাগবে না)।
   - Free প্ল্যান: ৫০০MB DB, ৫GB egress, ২টি active project।

2. **Schema তৈরি (দুটি SQL চালান)** — *SQL Editor → New query* → ফাইল দুটির কনটেন্ট পেস্ট করে **Run**:
   1. `supabase/migrations/20261008000001_init.sql` → টেবিল `news`, `feed_sources`, `scrape_logs`,
      ইনডেক্স, RLS পলিসি, Realtime পাবলিকেশন, ভিউ।
   2. `supabase/migrations/20261008000002_seed_feed_sources.sql` → ১৮টি ফিড যোগ হবে।

   CLI পছন্দ হলে: `supabase link --project-ref <ref>` তারপর `supabase db push`।

3. **ভেরিফাই করুন**
   ```sql
   select count(*) from public.news;              -- 0 (শুরুতে খালি)
   select count(*) from public.feed_sources;      -- 18
   select tablename from pg_publication_tables where pubname = 'supabase_realtime';  -- news থাকতে হবে
   ```
   Realtime তালিকায় `news` না থাকলে: *Database → Replication → supabase_realtime → news চালু করুন*
   (ওয়েবসাইটে "লাইভ আপডেট" কাজ করার জন্য দরকার; না হলে সাইট ৩০-সেকেন্ড রিফ্রেশেই ঠিক দেখাবে)।

4. **কী সংগ্রহ করুন** — *Project Settings → API*:
   | কী | কোথায় ব্যবহার হবে | প্রকাশ্য? |
   |---|---|---|
   | Project URL | Worker + ওয়েবসাইট | হ্যাঁ |
   | `anon` / publishable key | শুধু ওয়েবসাইট (Vercel env) | হ্যাঁ (RLS পড়া-মাত্র) |
   | `service_role` key | **শুধু** Cloudflare Worker secret | **কখনো না** |

---

## B. Cloudflare Worker (মনিটরিং)

```bash
cd worker
npm install

npx wrangler login                 # ব্রাউজারে Cloudflare অ্যাকাউন্টে লগইন

# সিক্রেট তিনটি (কোডে বা Git-এ কোথাও লিখবেন না)
npx wrangler secret put SUPABASE_URL                # https://<ref>.supabase.co
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY   # service_role key
npx wrangler secret put ADMIN_TOKEN                 # নিজের বানানো লম্বা র্যান্ডম টোকেন

npx wrangler deploy
```

সফল ডিপ্লয়ের পর যা দেখবেন: `https://news-monitor-worker.<your-subdomain>.workers.dev`

**ভেরিফাই করুন**
```bash
# ১) কনফিগারেশন ঠিক আছে কি না
curl https://news-monitor-worker.<sub>.workers.dev/health

# ২) ড্রাই-রান (কিছু লেখা হবে না, শুধু পার্সিং টেস্ট)
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
     "https://news-monitor-worker.<sub>.workers.dev/run?dry=1&items=3"

# ৩) আসল রান (সম্পূর্ণ তালিকা একবারে — ফ্রি প্ল্যানে CPU বাজেট বেশি লাগতে পারে,
#    তাই একবার চালিয়ে ঠিক আছে; নিয়মিত রান হবে স্লট-রোটেশনে)
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
     "https://news-monitor-worker.<sub>.workers.dev/run"

# ৪) লাইভ লগ
npx wrangler tail
```

**Cron Trigger যাচাই** — Cloudflare Dashboard → *Workers & Pages → news-monitor-worker → Settings →
Triggers*: `* * * * *` (প্রতি মিনিট) দেখা উচিত। লগে প্রতি মিনিটে `run_start` … `feed_done` …
`run_complete` JSON লাইন আসবে (`shard: "7/30"` এভাবে)।

### কীভাবে ৩০ মিনিটের চক্র কাজ করে
`slot = floor(UTC minute / FEED_SHARD_INTERVAL_MINUTES) % FEED_SHARDS` → ডিফল্টে **৩০টি স্লট,
প্রতি মিনিটে ১টি**: :00-এ Al Jazeera, :01-এ Anadolu … :17-এ POLITICO, :18–:29 খালি, :30-এ আবার
শুরু। ফলে প্রতিটি সোর্স **প্রতি ৩০ মিনিটে ঠিক একবার** চেক হয় এবং প্রতি invocation-এ CPU
সর্বোচ্চ ~৩.৫ms (ফ্রি প্ল্যানে ১০ms) — `npm run bench:shards` দিয়ে নিজেই মাপতে পারবেন।

**এক রানে সব ফিড (ঐচ্ছিক):** `wrangler.toml`-এ `FEED_SHARDS = "1"` এবং
`crons = ["*/30 * * * *"]`. Workers Paid (CPU ৩০ সেকেন্ড) ছাড়া ফ্রি প্ল্যানে এটি CPU লিমিটে
(`Error 1102`) ব্যর্থ হবে — তাই ম্যানুয়াল `/run` ছাড়া সুপারিশ করা হয় না।

**ফ্রি প্ল্যান সীমা (এই আর্কিটেকচারে গুরুত্বপূর্ণ)**
| সীমা | মান | প্রভাব |
|---|---|---|
| CPU/ইনভোকেশন | **১০ms** | তাই স্লট-রোটেশন (উপরে) |
| রিকোয়েস্ট/দিন | ১,০০,০০০ | আমাদের ~১৪৪০ + ম্যানুয়াল রান — সমস্যা নেই |
| Cron trigger/account | ৫ | আমরা ১টি ব্যবহার করি |
| Wall-clock (cron) | ~৩০s | প্রতি invocation-এ ১টি ফিড; WaPo ধীর (≈১০s) — ঠিক আছে |

---

## C. Vercel (ওয়েবসাইট)

### পথ ১ — GitHub থেকে Import (সুপারিশকৃত)
1. GitHub-এ রিপো পুশ করা আছে কিনা নিশ্চিত করুন (নিচে *GitHub* অংশ)।
2. https://vercel.com/new → **Import Git Repository** → রিপো বেছে নিন।
3. **Root Directory: `web`** (গুরুত্বপূর্ণ — রিপোতে worker + web দুটোই আছে)।
4. Environment Variables (Production + Preview):
   ```
   NEXT_PUBLIC_SUPABASE_URL      = https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = <anon key>       # service_role কখনো নয়!
   NEXT_PUBLIC_UI_LANG           = bn               # চাইলে en
   NEXT_PUBLIC_SITE_NAME         = নিউজ মনিটর
   ```
5. **Deploy** → `https://<project>.vercel.app`.

### পথ ২ — CLI
```bash
cd web
npx vercel login
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
npx vercel --prod
```
(Framework Preset: Next.js — নিজে থেকেই ধরে নেয়।)

### ভেরিফাই
1. হোম পেজে "ডেমো মোড" ব্যানার **না** থাকলে Supabase কানেক্টেড ✅
2. `/sources` পেজে ১৮টি ফিড, প্রতিটির সর্বশেষ চেক ও ফলাফল দেখা যাবে ✅
3. Worker-এ `POST /run` চালিয়ে ৩০–৬০ সেকেন্ডের মধ্যে সাইটে নতুন খবর এবং হেডারে
   **"N নতুন খবর"** পিল আসবে (Supabase Realtime) ✅
4. SQL: `select count(*), max(created_at) from public.news;` — সংখ্যা বাড়ছে ✅

> Vercel **Hobby** প্ল্যান ব্যক্তিগত/নন-কমার্শিয়াল ব্যবহারের জন্য। কোনো দিন বিজ্ঞাপন বা
> বাণিজ্যিক ব্যবহার যোগ করলে Pro প্ল্যান লাগবে — মনে রাখবেন।

---

## D. GitHub (রিপোজিটরি পুশ)

`news-monitor/` ফোল্ডারটি `git init` করা আছে এবং প্রথম কমিট তৈরি। দুটি পথ:

**পথ ১ — আপনি নিজে পুশ করবেন (কোনো টোকেন শেয়ার ছাড়াই)**
```bash
cd news-monitor
git remote add origin git@github.com:<আপনার-ইউজার>/news-monitor.git   # বা https URL
git push -u origin main
```

**পথ ২ — আমাকে পুশ করতে দেবেন**
আমাকে দিন: রিপো URL + একটি **fine-grained Personal Access Token** (শুধু ওই রিপোর
`Contents: Read and write`)। আমি পুশ করে দেব; কাজ শেষে টোকেনটি revoke করে দেবেন।

---

## E. ট্রাবলশুটিং

| লক্ষণ | কারণ | সমাধান |
|---|---|---|
| `scrape_logs`-এ `HTTP 403` | কিছু সাইট (যেমন POLITICO) bot-protection ব্যবহার করে | `feed_sources.feed_url` আপডেট করুন; বিকল্প URL যাচাই করে যোগ করুন |
| `HTTP 404` | প্রকাশক ফিড সরিয়ে/নাম বদল করেছে | `/sources` পেজে ত্রুটি দেখে নতুন URL যাচাই করে বসান |
| লগে `Error 1102` / `exceededCpu` | একটি invocation-এ বেশি CPU | `FEED_SHARDS` বাড়ান (যেমন ৬০ → প্রতি সোর্স ৬০ মিনিট) বা `ITEMS_PER_FEED` কমান |
| ওয়েবসাইটে ডেমো মোড | env ভ্যারিয়েবল নেই/ভুল | Vercel-এ `NEXT_PUBLIC_SUPABASE_*` ঠিক করে Redeploy |
| "লাইভ আপডেট বন্ধ" দেখায় | Realtime publication-এ `news` নেই | Supabase → Database → Replication → `news` চালু করুন |
| Supabase প্রজেক্ট paused | ৭ দিন কোনো ট্রাফিক নেই | Dashboard → Restore; Worker চালু থাকলে এমন হয় না |
| নতুন খবর আসছে না | cron বন্ধ / ফিড স্টেল | `wrangler tail`-এ লগ দেখুন; `/run?dry=1` দিয়ে ফিড ঠিক আছে কি না যাচাই করুন |

---

## F. নিরাপত্তা ও রক্ষণাবেক্ষণ

* **একটি কী ফাঁস হলে** — Supabase: *Settings → API → Rotate*; তারপর
  `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY` এবং Vercel env আপডেট করে Redeploy।
* **নতুন সোর্স যোগ** — `feed_sources`-এ একটি রো যোগ করুন (`is_active = true`) — কোড বদলাতে হবে না।
  একটি ভুল URL পুরো রান বন্ধ করবে না; ওই ফিড শুধু লগে ত্রুটি দেখাবে।
* **কোনো ফিড বন্ধ করা** — `update public.feed_sources set is_active = false where name = 'X';`
* **পুরনো খবর পরিষ্কার করা** (৫০০MB সীমা) —
  `delete from public.news where published_at < now() - interval '180 days';`
  বর্তমান হারে (≈৭০০ সারি/দিন) ৫০০MB-এ বছরের পর বছর ধরে চলবে, তবে বছরে একবার চেক করা ভালো।
* **HTML স্ক্র্যাপিং** ডিফল্টে বন্ধ (`OG_IMAGE_SCRAPE = "false"`)। শুধু og:image মেটা ট্যাগ পড়ার
  অনুমতি দিলে `"true"` করুন — তখনও সম্পূর্ণ আর্টিকেল কখনো পড়া/সংরক্ষণ করা হয় না।
