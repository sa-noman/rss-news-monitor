# আপনার করণীয় — ছোট চেকলিস্ট (১০ মিনিট)

সব শেষ হলে আমি আপনাকে দুটি লিংক দেব: **ওয়েবসাইট** আর **রোবটের স্বাস্থ্য পাতা (/sources)**।

---

## ১) Supabase — ডেটাবেস (৫ মিনিট) 🗄️

1. ব্রাউজারে খুলুন: **https://supabase.com/dashboard**
2. **New project** বাটন → Name: `news-monitor` → Region: **Southeast Asia (Singapore)** →
   Database Password: একটি শক্ত পাসওয়ার্ড (লিখে রাখুন) → Create
3. Project প্রস্তুত হতে ১–২ মিনিট লাগে। তারপর বাম মেনু → **Project Settings** → **API**
4. নিচের ৩টি কপি করে আমাকে পাঠান:

   | # | কোথায় | নাম |
   |---|---|---|
   | ১ | Project URL | `https://xxxxxxxx.supabase.co` |
   | ২ | Project API keys | `anon` / publishable key |
   | ৩ | Project API keys | `service_role` key ⚠️ গোপন |

5. **Database Password**-টাও পাঠিয়ে দিন (নিচে কী হবে দেখুন)।

> **Database Password কেন?** এটি দিয়ে আমি এক কমান্ডে টেবিল + নিয়ম + ১৮টি ফিড বসিয়ে দেব।
> না দিলে আপনাকে SQL Editor-এ ২টি ফাইল কপি-পেস্ট করে **Run** চাপতে হবে (আমি হুবহু বলে দেব)।

---

## ২) Cloudflare — রোবট (২ মিনিট) 🤖

1. খুলুন: **https://dash.cloudflare.com**
2. উপরে ডানে প্রোফাইল আইকন → **My Profile** → বাম মেনু **API Tokens**
3. **Create Token** → টেমপ্লেটের মধ্যে **"Edit Cloudflare Workers"**-এর **Use template**
4. Permissions ঠিক আছে কি না দেখে **Continue → Create Token**
5. দুইটি জিনিস আমাকে পাঠান:
   - **API Token** (একবারই দেখাবে, কপি করে নিন)
   - **Account ID** — Workers & Pages পেজ খুললে ডান দিকে সাইডবারে/URL-এ দেখা যায় (৩২ অক্ষরের)

---

## ৩) Vercel — ওয়েবসাইট (১ মিনিট) 🌐

1. খুলুন: **https://vercel.com/account/tokens** (GitHub দিয়ে লগইন করা যাবে)
2. **Create Token** → নাম দিন `news-monitor-deploy` → Create
3. টোকেনটি কপি করে আমাকে পাঠান

> GitHub থেকে import করার কাজটাও এতে আমিই করে দেব (রিপো: `sa-noman/rss-news-monitor`)।

---

## ৪) দুটি ছোট প্রশ্ন ✅

1. **og:image scraping** — যেসব ফিডে ছবি নেই (Al Jazeera, MEE, Foreign Affairs), তাদের কার্ডে ছবি আনার জন্য আর্টিকেল পেজ থেকে **শুধু og:image লিংক** পড়ব?
   উত্তর: **হ্যাঁ / না**
2. **ভাঙা ৪টি ফিডের বদল** — নিচের নতুন URL-গুলো ব্যবহার করব?
   - Anadolu: `aa.com.tr/en/rss/default?cat=live`
   - WSJ: `feeds.content.dowjones.io/public/rss/RSSWorldNews`
   - Haaretz: `srv/world-news-rss` + `srv/middle-east-news-rss`
   - POLITICO: `rss.politico.com/politics-news.xml`

   উত্তর: **হ্যাঁ / না**

---

## 🔒 কাজ শেষে রিভোক চেকলিস্ট

| জিনিস | করবেন |
|---|---|
| Cloudflare API Token | ✅ Revoke (https://dash.cloudflare.com/profile/api-tokens) |
| Vercel Token | ✅ Revoke (https://vercel.com/account/tokens) |
| Supabase keys (URL/anon/service_role) | ❌ Revoke করবেন না — সাইট ও রোবটের জ্বালানি |
| Supabase DB Password | ❌ রাখুন (দরকার নেই, তবে রাখাই ভালো) |

---

## তারপর আমি করব (২০ মিনিট)

1. Supabase-এ টেবিল, ইনডেক্স, নিয়ম (RLS) ও ১৮টি ফিড বসানো
2. Cloudflare-এ রোবট ডিপ্লয় + ৩টি গোপন কী + প্রতি-মিনিটের cron চালু
3. Vercel-এ সাইট ডিপ্লয় + ২টি env সেট
4. লাইভ টেস্ট — `/run` চালিয়ে দেখাব: কোন ফিড থেকে কত খবর এল, ডুপ্লিকেট হয়েছে কি না
5. আপনার দুটি লিংক + একটি ছোট রিপোর্ট দেব (কারা কাজ করছে, কত খবর জমেছে)
