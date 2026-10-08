/**
 * Keyword-based category classification (no paid AI APIs).
 *
 * Design notes
 *  - Pure function, own file: swapping in an LLM later means replacing
 *    `classifyNews` and nothing else.
 *  - Bilingual keyword sets (English + Bengali).
 *  - Title matches weigh 3x, summary matches 1x, multi-word phrases get +1.
 *  - Ties are broken by PRIORITY (topic categories beat region categories).
 *  - Nothing matches -> "Other".
 */

export const CATEGORIES = [
  'World',
  'Politics',
  'War & Conflict',
  'Economy & Business',
  'Technology',
  'Science',
  'Health',
  'Climate',
  'Sports',
  'Culture & Entertainment',
  'Middle East',
  'South Asia',
  'Opinion',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Lower index == higher priority when scores tie. */
const PRIORITY: Category[] = [
  'War & Conflict',
  'Politics',
  'Economy & Business',
  'Technology',
  'Health',
  'Climate',
  'Science',
  'Sports',
  'Culture & Entertainment',
  'Middle East',
  'South Asia',
  'Opinion',
  'World',
  'Other',
];

const KEYWORDS: Record<Exclude<Category, 'Other'>, string[]> = {
  'War & Conflict': [
    'war', 'wars', 'warfare', 'conflict', 'military', 'army', 'troops', 'soldier', 'soldiers',
    'airstrike', 'airstrikes', 'air strike', 'air strikes', 'missile', 'missiles', 'drone strike',
    'shelling', 'bombing', 'bombardment', 'ceasefire', 'cease-fire', 'truce', 'invasion', 'invade',
    'offensive', 'front line', 'frontline', 'militant', 'militants', 'insurgent', 'insurgents',
    'hostage', 'hostages', 'armed group', 'paramilitary', 'genocide', 'massacre',
    'clashes', 'escalation', 'declares war', 'mobilization', 'casualties', 'trade fire',
    'exchanged fire', 'cross-border fire', 'air raids', 'air raid', 'gunmen', 'militia',
    'militias', 'incursion', 'ground operation', 'military operation', 'armed attack',
    'suicide attack', 'terror attack', 'bomb attack', 'missile attack', 'drone attack',
    'defense ministry', 'weapons', 'arms deal', 'nuclear test', 'war crimes',
    'যুদ্ধ', 'যুদ্ধবিরতি', 'সামরিক', 'হামলা', 'সংঘর্ষ', 'আক্রমণ', 'সেনা', 'মিসাইল', 'নিহত', 'গোলাগুলি',
  ],
  Politics: [
    'politics', 'political', 'politician', 'politicians', 'election', 'elections', 'parliament',
    'parliamentary', 'president', 'prime minister', 'minister', 'ministry', 'government',
    'senate', 'congress', 'congressional', 'lawmaker', 'lawmakers', 'vote', 'votes', 'voters',
    'ballot', 'ballots', 'policy', 'policies', 'legislation', 'bill', 'cabinet', 'referendum',
    'impeachment', 'inauguration', 'campaign trail', 'white house', 'kremlin', 'downing street',
    'coalition government', 'opposition party', 'ruling party', 'sanctions', 'diplomacy',
    'european union', 'state visit', 'executive order',
    'নির্বাচন', 'সরকার', 'রাজনীতি', 'রাজনৈতিক', 'সংসদ', 'মন্ত্রী', 'প্রধানমন্ত্রী', 'রাষ্ট্রপতি',
    'ভোট', 'নেতা', 'নেতাকর্মী', 'আইন', 'কূটনীতি', 'নিষেধাজ্ঞা',
  ],
  'Economy & Business': [
    'economy', 'economic', 'economics', 'business', 'businesses', 'market', 'markets', 'finance',
    'financial', 'bank', 'banks', 'banking', 'trade', 'tariff', 'tariffs', 'inflation', 'deflation',
    'stock', 'stocks', 'shares', 'equities', 'gdp', 'recession', 'budget', 'tax', 'taxes',
    'debt', 'deficit', 'currency', 'dollar', 'euro', 'yen', 'rupee', 'yuan', 'interest rate',
    'central bank', 'federal reserve', 'fed', 'unemployment', 'jobs report', 'layoffs',
    'investor', 'investors', 'investment', 'ipo', 'merger', 'acquisition', 'earnings', 'revenue',
    'oil price', 'oil prices', 'crude oil', 'commodity', 'commodities', 'supply chain',
    'manufacturing', 'startup funding', 'venture capital', 'minimum wage', 'cost of living',
    'অর্থনীতি', 'অর্থনৈতিক', 'ব্যবসা', 'ব্যবসায়ী', 'বাজার', 'শেয়ার', 'ব্যাংক', 'মূল্যস্ফীতি',
    'বাণিজ্য', 'বিনিয়োগ', 'ঋণ', 'রপ্তানি', 'আমদানি', 'বাজেট', 'কর', 'ডলার', 'টাকা',
  ],
  Technology: [
    'technology', 'tech', 'technological', 'ai', 'artificial intelligence', 'machine learning',
    'software', 'hardware', 'smartphone', 'smartphones', 'iphone', 'android', 'internet',
    'cyber', 'cybersecurity', 'cyberattack', 'hacker', 'hackers', 'hacking', 'data center',
    'data centre', 'chip', 'chips', 'semiconductor', 'semiconductors', 'robot', 'robots',
    'robotics', 'app', 'apps', 'algorithm', 'algorithms', 'cryptocurrency', 'crypto', 'bitcoin',
    'blockchain', 'ransomware', 'malware', 'phishing', 'data breach', 'spyware', 'zero-day',
    'quantum computing', 'openai', 'chatgpt', 'google', 'microsoft', 'apple',
    'nvidia', 'meta platforms', 'tesla', 'spacex', 'social media', 'platform regulation',
    'startup', 'startups', 'silicon valley', 'digital', 'smartwatch', 'gadget',
    'প্রযুক্তি', 'কৃত্রিম বুদ্ধিমত্তা', 'সফটওয়্যার', 'ইন্টারনেট', 'স্মার্টফোন', 'মোবাইল', 'হ্যাক',
    'কম্পিউটার', 'ডিজিটাল', 'রোবট', 'অ্যাপ',
  ],
  Science: [
    'science', 'scientific', 'scientist', 'scientists', 'research', 'researchers', 'study finds',
    'new study', 'space', 'nasa', 'esa', 'spacecraft', 'satellite', 'satellites', 'rocket',
    'astronomy', 'astronomer', 'astronomers', 'telescope', 'planet', 'exoplanet', 'moon mission',
    'mars mission', 'physics', 'biologists', 'chemistry', 'genome', 'dna', 'archaeology',
    'archaeologists', 'fossil', 'fossils', 'discovery of', 'quantum physics', 'nobel prize',
    'বিজ্ঞান', 'বৈজ্ঞানিক', 'গবেষণা', 'মহাকাশ', 'নভোচারী', 'স্যাটেলাইট', 'আবিষ্কার', 'নোবেল',
  ],
  Health: [
    'health', 'healthcare', 'hospital', 'hospitals', 'doctor', 'doctors', 'nurse', 'nurses',
    'disease', 'diseases', 'illness', 'virus', 'viral', 'outbreak', 'epidemic', 'pandemic',
    'vaccine', 'vaccines', 'vaccination', 'who', 'world health organization', 'cancer', 'diabetes',
    'obesity', 'mental health', 'drug', 'drugs', 'medicine', 'medication', 'antibiotic',
    'measles', 'cholera', 'ebola', 'plague', 'flu', 'influenza', 'malaria', 'dengue',
    'surgery', 'treatment', 'patients', 'clinical trial', 'public health',
    'স্বাস্থ্য', 'স্বাস্থ্যসেবা', 'হাসপাতাল', 'রোগ', 'রোগী', 'ভ্যাকসিন', 'টিকা', 'মহামারি',
    'চিকিৎসা', 'ডাক্তার', 'ঔষধ', 'ক্যান্সার', 'ডেঙ্গু',
  ],
  Climate: [
    'climate', 'climate change', 'global warming', 'emission', 'emissions', 'carbon',
    'greenhouse gas', 'net zero', 'renewable', 'renewables', 'solar power', 'wind power',
    'energy transition', 'fossil fuel', 'fossil fuels', 'coal plant', 'drought', 'flood',
    'floods', 'flooding', 'wildfire', 'wildfires', 'hurricane', 'typhoon', 'cyclone', 'storm',
    'heatwave', 'heat wave', 'extreme weather', 'biodiversity', 'deforestation', 'glacier',
    'sea level', 'coral', 'cop30', 'environmental', 'ecosystem', 'un climate',
    'pollution', 'air pollution', 'plastic pollution', 'air quality', 'energy crisis',
    'clean energy', 'green energy', 'climate summit', 'climate finance',
    'জলবায়ু', 'জলবায়ু পরিবর্তন', 'পরিবেশ', 'পরিবেশগত', 'বন্যা', 'খরা', 'ঘূর্ণিঝড়', 'দূষণ',
    'তাপপ্রবাহ', 'কার্বন', 'নবায়নযোগ্য',
  ],
  Sports: [
    'sports', 'sport', 'football', 'soccer', 'cricket', 'tennis', 'basketball', 'baseball',
    'hockey', 'golf', 'rugby', 'olympics', 'olympic', 'world cup', 'premier league', 'fifa',
    'uefa', 'champions league', 'ipl', 'la liga', 'nba', 'nfl', 'serie a', 'bundesliga',
    'match', 'matches', 'tournament', 'tournament', 'coach', 'head coach', 'transfer window',
    'goalkeeper', 'striker', 'wicket', 'innings', 'f1', 'formula one', 'grand slam', 'boxing',
    'wrestling', 'marathon', 'athlete', 'athletes', 'চ্যাম্পিয়ন',
    'খেলাধুলা', 'খেলা', 'ক্রিকেট', 'ফুটবল', 'ম্যাচ', 'অলিম্পিক', 'টুর্নামেন্ট', 'কোচ', 'খেলোয়াড়',
    'বিশ্বকাপ',
  ],
  'Culture & Entertainment': [
    'culture', 'cultural', 'entertainment', 'film', 'films', 'movie', 'movies', 'cinema',
    'musician', 'music', 'album', 'band', 'singer', 'rapper', 'actor', 'actress', 'hollywood',
    'bollywood', 'netflix', 'streaming', 'tv series', 'television series', 'showrunner',
    'festival', 'art', 'artist', 'artists', 'exhibition', 'museum', 'book', 'novel', 'author',
    'poet', 'poetry', 'fashion', 'celebrity', 'celebrities', 'grammy', 'oscar', 'oscars',
    'box office', 'video game', 'gaming', 'eurovision', 'theatre', 'theater',
    'সংস্কৃতি', 'সাংস্কৃতিক', 'বিনোদন', 'চলচ্চিত্র', 'সিনেমা', 'গান', 'গায়ক', 'অভিনেতা', 'অভিনেত্রী',
    'নাটক', 'উৎসব', 'শিল্পী', 'বই', 'সাহিত্য',
  ],
  'Middle East': [
    'middle east', 'mideast', 'gaza', 'gazan', 'israel', 'israeli', 'israelis', 'palestinian',
    'palestinians', 'palestine', 'west bank', 'rafah', 'lebanon', 'lebanese', 'hezbollah',
    'hamas', 'syria', 'syrian', 'damascus', 'iran', 'iranian', 'tehran', 'iraq', 'iraqi',
    'baghdad', 'yemen', 'yemeni', 'houthi', 'houthis', 'saudi', 'riyadh', 'uae', 'emirati',
    'dubai', 'abu dhabi', 'qatar', 'qatari', 'doha', 'jordan', 'amman', 'egypt', 'cairo',
    'turkey', 'türkiye', 'ankara', 'istanbul', 'erdogan', 'netanyahu', 'beirut', 'tel aviv',
    'jerusalem', 'gulf state', 'red sea shipping', 'gulf cooperation council',
    'মধ্যপ্রাচ্য', 'ইসরায়েল', 'ফিলিস্তিন', 'গাজা', 'ইরান', 'সিরিয়া', 'লেবানন', 'তুরস্ক', 'সৌদি',
    'মিসর', 'ইরাক', 'ইয়েমেন',
  ],
  'South Asia': [
    'south asia', 'south asian', 'india', 'indian', 'delhi', 'new delhi', 'modi', 'kashmir',
    'pakistan', 'pakistani', 'karachi', 'lahore', 'islamabad', 'rawalpindi',
    'bangladesh', 'bangladeshi', 'dhaka', 'chittagong', 'chattogram', 'sri lanka', 'sri lankan',
    'colombo', 'nepal', 'nepali', 'kathmandu', 'bhutan', 'maldives', 'afghanistan', 'afghan',
    'kabul', 'taliban', 'pashtun', 'balochistan',
    'ভারত', 'ভারতীয়', 'পাকিস্তান', 'বাংলাদেশ', 'বাংলাদেশী', 'ঢাকা', 'চট্টগ্রাম', 'কলকাতা', 'দিল্লি',
    'কাশ্মীর', 'শ্রীলঙ্কা', 'কোলম্বো', 'নেপাল', 'কাঠমান্ডু', 'আফগানিস্তান', 'তালেবান', 'মালদ্বীপ',
  ],
  Opinion: [
    'opinion', 'op-ed', 'op ed', 'oped', 'editorial', 'commentary', 'column', 'columnist',
    'viewpoint', 'perspective', 'essay', 'analysis', 'the argument', 'guest essay',
    'আমার কথা', 'মতামত', 'সম্পাদকীয়', 'বিশ্লেষণ', 'কলাম', 'মন্তব্য',
  ],
  World: [
    'world', 'global', 'international', 'foreign', 'united nations', 'un general assembly',
    'nato', 'g7', 'g20', 'brics', 'commonwealth', 'summit', 'world leaders', 'global summit',
    'world news', 'international community', 'cross-border',
    'বিশ্ব', 'বৈশ্বিক', 'আন্তর্জাতিক', 'জাতিসংঘ', 'বিদেশ', 'শীর্ষ সম্মেলন',
  ],
};

const TITLE_WEIGHT = 3;
const SUMMARY_WEIGHT = 1;
const PHRASE_BONUS = 1;

/**
 * Region categories are useful but weaker signals than topic categories:
 * "Israel and Hezbollah trade fire" is a War & Conflict story that happens to
 * be in the Middle East. Their score is damped so that a topic category wins
 * when both look plausible; a region still wins when no topic applies.
 */
const REGION_WEIGHT = 0.6;
const REGION_CATEGORIES: ReadonlySet<Category> = new Set<Category>(['Middle East', 'South Asia']);

/* ---------------------------------------------------------------------------
   Performance: instead of testing ~700 keywords one by one (≈700 regex runs
   per story), every keyword of every category is compiled into ONE global
   alternation regex plus a keyword -> categories lookup. Classification of a
   story therefore costs two regex passes (title, summary) in total — essential
   because Cloudflare's free plan gives a cron invocation only 10 ms of CPU.
   Longest keywords come first so "air pollution" is preferred over "pollution".
--------------------------------------------------------------------------- */
function escapeKeyword(keyword: string): string {
  return keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
}

const KEYWORD_TO_CATEGORIES = new Map<string, Category[]>();
for (const category of Object.keys(KEYWORDS) as Array<Exclude<Category, 'Other'>>) {
  for (const raw of KEYWORDS[category]) {
    const keyword = raw.toLowerCase().replace(/\s+/g, ' ');
    const list = KEYWORD_TO_CATEGORIES.get(keyword);
    if (list) {
      if (!list.includes(category)) list.push(category);
    } else {
      KEYWORD_TO_CATEGORIES.set(keyword, [category]);
    }
  }
}

const ALL_KEYWORDS = [...KEYWORD_TO_CATEGORIES.keys()].sort((a, b) => b.length - a.length);

const ALL_KEYWORDS_RE = new RegExp(
  // Unicode-aware boundaries work for ASCII and Bengali alike and stop false
  // hits such as "ai" inside "said" or "war" inside "warning".
  `(?<![\\p{L}\\p{N}])(?:${ALL_KEYWORDS.map(escapeKeyword).join('|')})(?![\\p{L}\\p{N}])`,
  'giu',
);

function matchedKeywords(text: string): Set<string> {
  const out = new Set<string>();
  if (!text) return out;
  ALL_KEYWORDS_RE.lastIndex = 0;
  const found = text.match(ALL_KEYWORDS_RE);
  if (!found) return out;
  for (const raw of found) out.add(raw.toLowerCase().replace(/\s+/g, ' '));
  return out;
}

export interface ClassificationResult {
  category: Category;
  score: number;
  matched: string[];
  scores: Partial<Record<Category, number>>;
}

/**
 * Classify a story from its title + summary only (never the full article).
 * @param title   cleaned headline
 * @param summary cleaned summary/description (optional)
 */
export function classifyNews(title: string, summary?: string | null): ClassificationResult {
  const inTitle = matchedKeywords((title ?? '').toLowerCase());
  const inSummary = matchedKeywords((summary ?? '').toLowerCase());

  const scores: Partial<Record<Category, number>> = {};
  const matches: Partial<Record<Category, string[]>> = {};

  const add = (keyword: string, weight: number) => {
    const bonus = keyword.includes(' ') ? PHRASE_BONUS : 0;
    for (const category of KEYWORD_TO_CATEGORIES.get(keyword) ?? []) {
      scores[category] = (scores[category] ?? 0) + weight + bonus;
      (matches[category] ??= []).push(keyword);
    }
  };

  for (const keyword of inTitle) add(keyword, TITLE_WEIGHT);
  for (const keyword of inSummary) {
    if (inTitle.has(keyword)) continue; // already counted at title weight
    add(keyword, SUMMARY_WEIGHT);
  }

  let best: Category = 'Other';
  let bestWeighted = 0;
  for (const category of PRIORITY) {
    const raw = scores[category] ?? 0;
    if (raw <= 0) continue;
    const weighted = REGION_CATEGORIES.has(category) ? Math.round(raw * REGION_WEIGHT * 100) / 100 : raw;
    if (weighted > bestWeighted) {
      best = category;
      bestWeighted = weighted;
    }
  }

  return {
    category: best,
    score: scores[best] ?? 0,
    matched: matches[best as Exclude<Category, 'Other'>] ?? [],
    scores,
  };
}

/** Exposed for diagnostics/tests: keyword inventory of the classifier. */
export function keywordStats(): { categories: number; keywords: number; patterns: number } {
  return { categories: Object.keys(KEYWORDS).length, keywords: ALL_KEYWORDS.length, patterns: 1 };
}
