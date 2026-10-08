# LIVE-STATUS.md — ডিপ্লয়মেন্ট রেকর্ড (৮ অক্টোবর ২০২৬)

## 🔗 লাইভ ঠিকানা

| কী | ঠিকানা |
|---|---|
| **ওয়েবসাইট (Vercel)** | https://news-monitor-web-gamma.vercel.app |
| **মনিটরিং / সোর্স স্বাস্থ্য পেজ** | https://news-monitor-web-gamma.vercel.app/sources |
| ডেটা নীতি পেজ | https://news-monitor-web-gamma.vercel.app/about |
| **রোবট (Cloudflare Worker)** | https://news-monitor-worker.sanoman-bd.workers.dev |
| রোবট স্বাস্থ্য (JSON) | https://news-monitor-worker.sanoman-bd.workers.dev/health |
| GitHub রিপো | https://github.com/sa-noman/rss-news-monitor |

## 🧱 ব্যবহৃত সেবা ও প্রজেক্ট

| অংশ | সেবা | আইডেন্টিফায়ার |
|---|---|---|
| ডেটাবেস | Supabase (PostgreSQL 17.11, `ap-northeast-2` সিউল) | ref `oacmjfbikvhwbfbzeoxd` |
| রোবট | Cloudflare Workers (workers.dev সাবডোমেইন) | `news-monitor-worker.sanoman-bd` |
| ওয়েবসাইট | Vercel (প্রজেক্ট `news-monitor-web`) | টিম `noman-17e9` |

**Vercel-এ Deployment Protection বন্ধ করা হয়েছে** (public সাইটের জন্য জরুরি ছিল — নাহলে সবাইকে
Vercel-এ লগইন করতে হতো)।

## ✅ যাচাইয়ের প্রমাণ (সব লাইভ, ৮ অক্টোবর ২০২৬)

| পরীক্ষা | ফলাফল |
|---|---|
| Supabase স্কিমা (৩ টেবিল + ইনডেক্স + RLS) | ✅ তৈরি (`tables_created=3`, `rls_enabled=3`) |
| ১৮টি ফিড seed | ✅ `feeds=18` |
| `link`-এ UNIQUE (ডুপ্লিকেট নিয়ন্ত্রণ) | ✅ `unique_link=1` এবং ব্যবহারিক পরীক্ষায় প্রমাণিত |
| Realtime publication-এ `news` | ✅ `realtime_on=1` |
| ম্যানুয়াল ফেটচ (১৮টি সোর্স) | ✅ ১৮/১৮ সফল, **২৩৯টি আইটেম**, কোনো ব্যর্থতা নেই |
| ডুপ্লিকেট পরীক্ষা (একই ফিড আবার) | ✅ `items_inserted=0` — দ্বিতীয়বার কিছু ঢোকেনি |
| anon/publishable key দিয়ে পড়া | ✅ ২৩৯ সারি পড়া গেছে (RLS public read) |
| anon key দিয়ে **লেখার** চেষ্টা | ✅ **ব্লক** (`42501 row-level security`) — নিরাপত্তা ঠিক |
| **cron নিজে থেকে চালু হয়েছে** | ✅ ০৯:৩১:০০ → Al Jazeera (২৫ পাওয়া, **১০ নতুন**); ০৯:৩১:৪৬ → Anadolu (২৫ পাওয়া, **১০ নতুন**) |
| cron → `scrape_logs` ও `feed_sources.last_checked_at` | ✅ দুটোই লেখা হয়েছে |
| cron → রোবট → ডেটাবেস → ওয়েবসাইট (সম্পূর্ণ চেইন) | ✅ হোমে ২৪টি কার্ড, ডেমো ব্যানার নেই |
| ওয়েবসাইট পাবলিক (লগইন ছাড়া) | ✅ HTTP 200 |
| CPU বাজেট (ফ্রি প্ল্যান ১০ms) | ✅ লাইভ লগে **cpu=1ms** প্রতি invocation-এ (মাপা) |

**বর্তমান ডেটা:** ২৫৯টি খবর, ১৮টি সোর্স, ক্যাটাগরি বণ্টন — Middle East ৬৪ · Politics ৫২ ·
Other ২৭ · War & Conflict ২৬ · Economy & Business ১৯ · Technology ১৭ · Health ৯ · World ৭ ·
South Asia ৬ · Science ৫ · Climate ৩ · Sports ৩ · Culture & Entertainment ১

## ⏱️ সময়সূচি যেভাবে চলছে

* Cron: `* * * * *` (প্রতি মিনিটে ১ টিক) — Cloudflare-এর ডেলিভারিতে ৪৫–৬০ সেকেন্ডের জিটার আছে,
  যেমন ০৯:৩০ মিনিটের টিক ০৯:৩১:০০-এ এসেছে। স্লট হিসাব হয় **নির্ধারিত মিনিট** থেকে
  (`slot = UTC minute % 30`), তাই জিটারে কোনো ফিড বাদ পড়ে না বা দুইবার পড়ে না।
* স্লট ১–১৮ = ফিড ১–১৮; স্লট ১৯–৩০ = কিছুই করে না (খালি, খরচ প্রায় ১ms CPU)।
* ফলে **প্রতিটি সোর্স ঠিক প্রতি ৩০ মিনিটে একবার** চেক হয়, আর প্রতি invocation-এ CPU ~১–৪ms।

## 🔐 গোপন তথ্য কোথায় আছে

| জিনিস | কোথায় | রিভোক? |
|---|---|---|
| Supabase URL + secret key | Cloudflare Worker secret | ❌ থাকবে |
| Supabase publishable key + URL | Vercel env | ❌ থাকবে |
| `ADMIN_TOKEN` (ম্যানুয়াল রান) | Cloudflare Worker secret + ওয়েবসাইট আউটপুটের বাইরে | ❌ থাকবে (দরকার হলে rotate) |
| Supabase PAT (`sbp_...`) | শুধু কাজের সময়ে, ওয়ার্কস্পেসের বাইরে `ops/` | ✅ **revoke করুন** |
| Cloudflare API token | একই (`ops/`) | ✅ **revoke করুন** |
| Vercel token | একই (`ops/`) | ✅ **revoke করুন** |

> কোনোটিই Git রিপোতে কমিট করা হয়নি; `.env.example`-এ শুধু খালি উদাহরণ আছে।

## 📌 বাকি ছোট কাজ

1. **GitHub-এ ২টি কমিট পুশ করা বাকি** (`b5362b6` — cron ফিক্স, `docs` আপডেট)। GitHub টোকেন
   revoke হয়ে গেছে, তাই নতুন টোকেন দিলে (বা `git push` নিজে করলে) পুশ হয়ে যাবে।
   ডিপ্লয়ে কোনো প্রভাব নেই — Cloudflare-এ কোডটি ইতিমধ্যেই সঠিক ভার্সনে চলছে।
2. **og:image scraping** — আপনার অনুমতি এলে `OG_IMAGE_SCRAPE=true` করে দেব (একটি ভ্যারিয়েবল)।
3. চাইলে যোগ করা যায়: বাংলা খবরের ফিড, টেলিগ্রাম/ইমেইল অ্যালার্ট, AI ক্লাসিফিকেশন,
   পুরনো খবর স্বয়ংক্রিয়ভাবে মোছার রুটিন।
