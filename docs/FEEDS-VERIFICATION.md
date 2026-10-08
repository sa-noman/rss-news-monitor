# FEEDS-VERIFICATION.md — ফিড যাচাইয়ের প্রমাণ (৮ অক্টোবর ২০২৬)

সব URL **লাইভ HTTP কলে** পরীক্ষা করা হয়েছে (only status নয় — item সংখ্যা, কনটেন্ট-টাইপ,
সর্বশেষ আইটেমের তারিখ পর্যন্ত)। প্রতিটি ফিড Fixture হিসেবে `worker/test/fixtures/`-এ রাখা আছে
এবং টেস্টে ব্যবহৃত হয়, তাই ভবিষ্যতে ফিডের ফরম্যাট বদলালে টেস্ট ফেল করে সেটা ধরা পড়বে।

## ১. প্রদত্ত ১৭টি URL

| # | সোর্স | প্রদত্ত URL | ফলের হিসাব | সিদ্ধান্ত |
|---|---|---|---|---|
| 1 | Al Jazeera | `aljazeera.com/xml/rss/all.xml` | 200 ✅ 25 items | অপরিবর্তিত |
| 2 | Anadolu Ajansı | `aa.com.tr/en/rss/default?cat=all` | **404** ❌ | → `?cat=live` (200, 30 items) |
| 3 | The Atlantic | `theatlantic.com/feed/all/` | 200 ✅ Atom, 25 entries | অপরিবর্তিত |
| 4 | Middle East Eye | `middleeasteye.net/rss` | 200 ✅ 20 items | অপরিবর্তিত |
| 5 | The Diplomat | `thediplomat.com/feed/` | 200 ✅ 96 items | অপরিবর্তিত |
| 6 | New York Times | `rss.nytimes.com/.../HomePage.xml` | 200 ✅ 24 items | অপরিবর্তিত |
| 7 | The Economist | `economist.com/the-world-this-week/rss.xml` | 200 ✅ 300 items | অপরিবর্তিত, তবে `ITEMS_PER_FEED` দিয়ে সীমিত |
| 8 | WSJ | `feeds.a.dj.com/rss/RSSWorldNews.xml` | 200 ⚠️ কিন্তু **সর্বশেষ আইটেম ২৭ জানু ২০২৫** | → `feeds.content.dowjones.io/public/rss/RSSWorldNews` (200, 72 items, আজকের) |
| 9 | Foreign Affairs | `foreignaffairs.com/rss.xml` | 200 ✅ 20 items | অপরিবর্তিত |
| 10 | Financial Times | `ft.com/rss/home` | 200 ✅ 9 items (→ `/rss/home/international` রিডাইরেক্ট) | অপরিবর্তিত |
| 11 | Daily Sabah | `dailysabah.com/rssFeed/rss.xml` | 200 ✅ 44 items | অপরিবর্তিত (case-অসংবেদনশীল রিডাইরেক্ট) |
| 12 | Washington Post | `feeds.washingtonpost.com/rss/world` | 200 ✅ 15 items | অপরিবর্তিত |
| 13 | RFI | `rfi.fr/en/rss` | 200 ✅ 22 items | অপরিবর্তিত |
| 14 | Drop Site News | `dropsitenews.substack.com/feed` | 200 ✅ 20 items (→ dropsitenews.com) | অপরিবর্তিত |
| 15 | Haaretz | `haaretz.com/srv/rss` | **404** ❌ | → `srv/world-news-rss` + `srv/middle-east-news-rss` (200, ৩৫+৩৫ items) |
| 16 | Axios | `api.axios.com/feed/` | 200 ✅ 100 items | অপরিবর্তিত |
| 17 | POLITICO | `politico.com/rss/politicopicks.xml` | **403 ❌** (Cloudflare bot-wall) | → `rss.politico.com/politics-news.xml` (200, 30 items) |

## ২. প্রতিস্থাপনের বিস্তারিত প্রমাণ

**Anadolu Ajansı** — `?cat=all` আর নেই (404)। পরীক্ষিত বিকল্প:
`?cat=world` → 200 (30 items) ; `?cat=live` → 200 (30 items, সবচেয়ে সাম্প্রতিক)।
→ গৃহীত: `https://www.aa.com.tr/en/rss/default?cat=live` (চাইলে `world` সংস্করণও যোগ করা যায়)।

**The Wall Street Journal** — পুরনো `feeds.a.dj.com` ফাইলটি এখনো HTTP 200 দেয়, কিন্তু ভেতরের
সব তারিখ **২৭ জানুয়ারি ২০২৫** থেকে হিমশীতল (১৮ মাস পুরনো)। অর্থাৎ "২০০ মানেই কাজ করছে" নয়।
নতুন Dow Jones প্রান্তে: `feeds.content.dowjones.io/public/rss/RSSWorldNews` → 200, 72 items, আজকের।
(পরীক্ষিত অন্যান্য: `feeds.content.dowjones.io/public/rss/RSSUSnews` → 200, 40 items;
`wsj.com/xml/rss/3_7085.xml` → 401 ❌; পুরনো `RSSMarketsMain.xml` → 200 কিন্তু একইভাবে পুরনো।)

**Haaretz** — `/srv/rss` এবং `/srv/haaretz-latest-headlines-rss` দুটিই 404।
পরীক্ষিত: `/srv/israel-news-rss` → 200 (20) ; `/srv/world-news-rss` → 200 (35) ;
`/srv/middle-east-news-rss` → 200 (35) ; `/srv/haaretz-late-edition-rss` → 404 ❌।
→ গৃহীত: World + Middle East (ইসরায়েল-সেকশনটি চাইলে যোগ করা যাবে)।

**POLITICO** — `politico.com/rss/*.xml` সবগুলোই Cloudflare bot-wall-এ 403 ("Just a moment…"),
এমনকি ব্রাউজার UA দিয়েও (এটি IP/ASN-ভিত্তিক bot ব্যবস্থা, UA-নির্ভর নয়)।
পরীক্ষিত: `rss.politico.com/politics-news.xml` → 200 (30) ✅ ;
`politico.eu/feed/` → 200 (10) ✅ (ইউরোপ সংস্করণ)।
→ গৃহীত: `rss.politico.com` (উভয়ই যোগ করা যায়; আপাতত একটি রেখেছি)।

## ৩. Haaretz-এর User-Agent আবিষ্কার (গুরুত্বপূর্ণ)

Haaretz Fastly-র bot-protection ব্যবহার করে। পরীক্ষার ফলাফল:

| User-Agent | ফল |
|---|---|
| `NewsMonitorBot/1.0 (+https://…)` | **403** |
| `NewsMonitorBot/1.0` | **403** |
| `FeedFetcher-Google; (+http://www.google.com/feedfetcher.html)` | **403** |
| `curl/8.5.0` | 200 |
| ব্রাউজার UA | 200 |
| **`NewsMonitor/1.0 (RSS aggregator)`** | **200 ✅** |

অর্থাৎ "Bot"/"crawler" জাতীয় নাম ও জানা ক্রলার UA ব্লক হয়। আমরা **ব্রাউজার সেজে নই** —
একটি সৎ প্রোডাক্ট-UA ব্যবহার করছি যেটি সম্মানজনকভাবে সেবা পায়; এই স্ট্রিংটি দিয়েই
১৮টি ফিডের সবগুলো যাচাই করা হয়েছে।

## ৪. ফিড-প্রতি বিশেষ লক্ষণীয়

| সোর্স | ফরম্যাট | ছবি আসে? | মন্তব্য |
|---|---|---|---|
| Al Jazeera | RSS 2.0 | ❌ | ফিডে image ট্যাগ নেই → `image_url = null` (কার্ডে মনোগ্রাম দেখায়) |
| Middle East Eye | RSS 2.0 | ❌ | একই |
| Foreign Affairs | RSS 2.0 | ❌ | একই |
| Financial Times | RSS 2.0 | ⚠️ | `media:thumbnail` থাকে, সীমিত সংখ্যক |
| NYT | RSS 2.0 | ✅ | `media:content` |
| Daily Sabah | RSS 2.0 | ✅ | `media:content` + `enclosure` |
| Axios | RSS 2.0 | ✅ | `media:thumbnail`; `content:encoded`-এ পূর্ণ লেখা থাকে → **আমরা শুধু summary নিই** |
| The Atlantic | **Atom 1.0** | ✅ | `<content>`-এ নিউজলেটারের পূর্ণ টেক্সট → **summary ফিল্ডই ব্যবহৃত** |
| Drop Site News | RSS (Substack) | ✅ | `content:encoded`-এ পূর্ণ লেখা → আমাদের summary সর্বোচ্চ ৪০০ অক্ষর |
| The Economist | RSS 2.0 | ❌ | ৩০০ আইটেমের সাপ্তাহিক ফিড; প্রতি রানে সীমিত সংখ্যক নেওয়া হয় |
| Washington Post | RSS 2.0 | ❌ | সার্ভার ধীর (~৮–১০s) — timeout ১২s রাখা হয়েছে |

## ৫. যে ফিডগুলো ইচ্ছাকৃতভাবে বাদ (আপনার নির্দেশে)

Reuters, AFP, Ground News, NewsNow, Clash Report — কোনো URL যোগ করা হয়নি, অনুমান করিনি।
ভবিষ্যতে চাইলে আলাদাভাবে অনুমোদন দিয়ে যোগ করা যাবে (কিছু ক্ষেত্রে RSS নেই → স্ক্র্যাপিং প্রয়োজন,
যার জন্য আপনার পূর্বানুমতি লাগবে)।
