/**
 * UI strings. Set NEXT_PUBLIC_UI_LANG=bn (default) or =en in the Vercel env.
 */
export type Lang = 'bn' | 'en';

const DICT = {
  bn: {
    siteName: 'নিউজ মনিটর',
    tagline: 'আন্তর্জাতিক সংবাদ এক জায়গায় — প্রতি ৩০ মিনিটে স্বয়ংক্রিয় আপডেট',
    sourcesShort: 'সোর্স',
    searchPlaceholder: 'শিরোনাম বা সারসংক্ষেপ খুঁজুন…',
    search: 'খুঁজুন',
    allCategories: 'সব',
    filterByCategory: 'ক্যাটাগরি',
    filterBySource: 'সোর্স',
    clearFilters: 'ফিল্টার মুছুন',
    latest: 'সর্বশেষ খবর',
    newStories: 'নতুন খবর',
    refreshHint: 'নতুন সংবাদ এসেছে — দেখতে ক্লিক করুন',
    live: 'লাইভ',
    connecting: 'সংযোগ হচ্ছে…',
    realtimeOff: 'লাইভ আপডেট বন্ধ',
    demoModeTitle: 'ডেমো মোড',
    demoModeBody:
      'Supabase কনফিগার করা নেই, তাই নমুনা ডেটা দেখানো হচ্ছে। env ভ্যারিয়েবল যোগ করলেই আসল খবর আসবে।',
    noResults: 'কোনো খবর পাওয়া যায়নি',
    noResultsHint: 'অন্য ক্যাটাগরি বা সার্চ শব্দ দিয়ে দেখুন।',
    readAtSource: 'মূল সোর্সে পড়ুন',
    prev: 'পূর্ববর্তী',
    next: 'পরবর্তী',
    page: 'পাতা',
    showing: 'দেখানো হচ্ছে',
    of: 'এর মধ্যে',
    items: 'সংবাদ',
    sourceHealth: 'সোর্স মনিটরিং',
    sourceHealthIntro:
      'Worker প্রতি ৩০ মিনিটে প্রতিটি ফিড চেক করে। নিচে প্রতিটি সোর্সের সর্বশেষ অবস্থা।',
    recentRuns: 'সাম্প্রতিক চেক লগ',
    status: 'অবস্থা',
    source: 'সোর্স',
    lastChecked: 'সর্বশেষ চেক',
    lastSuccess: 'সর্বশেষ সফল',
    lastError: 'সর্বশেষ ত্রুটি',
    itemsFound: 'পাওয়া গেছে',
    itemsInserted: 'নতুন সংরক্ষিত',
    duration: 'সময়',
    never: 'কখনো নয়',
    start: 'শুরুর সংস্করণ',
    about: 'ডেটা নীতি',
    aboutTitle: 'আমরা কী সংগ্রহ করি, কী করি না',
    aboutBody:
      'আমরা কেবল খবরের শিরোনাম, সংক্ষিপ্ত সারাংশ, প্রকাশের সময়, সোর্সের নাম ও মূল লিংক সংরক্ষণ করি — RSS ফিডে যা দেওয়া থাকে তাই। কোনো সংবাদ সংস্থার সম্পূর্ণ আর্টিকেল কপি করা হয় না; প্রতিটি খবরের সঙ্গে মূল সোর্সের লিংক দেওয়া থাকে এবং বিস্তারিত পড়তে সেটিতেই যেতে হয়।',
    aboutHow: 'সিস্টেম কীভাবে কাজ করে',
    aboutHowBody:
      'Cloudflare Worker প্রতি ৩০ মিনিটে RSS/Atom ফিড পড়ে → নতুন খবর Supabase-এ সংরক্ষণ করে (একই লিংক দুবার সংরক্ষিত হয় না) → Vercel-এ হোস্ট করা এই সাইট Supabase Realtime দিয়ে সাথে সাথে আপডেট হয়।',
    footerNote: 'শুধু শিরোনাম, সারাংশ ও মূল লিংক — সম্পূর্ণ আর্টিকেল নয়।',
    liveFrom: 'সরাসরি',
    updated: 'আপডেট',
    error: 'ত্রুটি',
    ok: 'সফল',
    empty: 'খালি',
    skipped: 'বাদ',
    active: 'সক্রিয়',
    inactive: 'নিষ্ক্রিয়',
  },
  en: {
    siteName: 'News Monitor',
    tagline: 'International news in one place — refreshed every 30 minutes',
    sourcesShort: 'sources',
    searchPlaceholder: 'Search headlines or summaries…',
    search: 'Search',
    allCategories: 'All',
    filterByCategory: 'Category',
    filterBySource: 'Source',
    clearFilters: 'Clear filters',
    latest: 'Latest stories',
    newStories: 'new stories',
    refreshHint: 'click to load them',
    live: 'Live',
    connecting: 'Connecting…',
    realtimeOff: 'Live updates off',
    demoModeTitle: 'Demo mode',
    demoModeBody:
      'Supabase is not configured, so bundled sample data is shown. Add the env vars to display live news.',
    noResults: 'No stories found',
    noResultsHint: 'Try another category or search term.',
    readAtSource: 'Read at source',
    prev: 'Previous',
    next: 'Next',
    page: 'Page',
    showing: 'Showing',
    of: 'of',
    items: 'stories',
    sourceHealth: 'Source monitoring',
    sourceHealthIntro: 'The worker checks every feed every 30 minutes. Latest state per source below.',
    recentRuns: 'Recent check log',
    status: 'Status',
    source: 'Source',
    lastChecked: 'Last checked',
    lastSuccess: 'Last success',
    lastError: 'Last error',
    itemsFound: 'Found',
    itemsInserted: 'New',
    duration: 'Took',
    never: 'never',
    start: 'Getting started',
    about: 'Data policy',
    aboutTitle: 'What we collect — and what we never do',
    aboutBody:
      'We store only what the RSS feed publishes: headline, short summary, publication time, source name and the original link. We never copy or republish full articles; every card links back to the original publisher where you can read the story.',
    aboutHow: 'How the system works',
    aboutHowBody:
      'A Cloudflare Worker reads RSS/Atom feeds every 30 minutes → stores new stories in Supabase (a link can never be stored twice) → this Vercel-hosted site updates instantly via Supabase Realtime.',
    footerNote: 'Headlines, summaries and source links only — never full articles.',
    liveFrom: 'Live from',
    updated: 'Updated',
    error: 'error',
    ok: 'success',
    empty: 'empty',
    skipped: 'skipped',
    active: 'active',
    inactive: 'inactive',
  },
} as const;

/** Widened to plain strings so both dictionaries share one type. */
export type Dict = Record<keyof (typeof DICT)['bn'], string>;

export const UI_LANG: Lang = process.env.NEXT_PUBLIC_UI_LANG === 'en' ? 'en' : 'bn';

export function t(): Dict {
  return DICT[UI_LANG];
}

/** Category label in the current UI language (categories stay English in the DB). */
const CATEGORY_BN: Record<string, string> = {
  World: 'বিশ্ব',
  Politics: 'রাজনীতি',
  'War & Conflict': 'যুদ্ধ ও সংঘাত',
  'Economy & Business': 'অর্থনীতি ও ব্যবসা',
  Technology: 'প্রযুক্তি',
  Science: 'বিজ্ঞান',
  Health: 'স্বাস্থ্য',
  Climate: 'জলবায়ু',
  Sports: 'খেলাধুলা',
  'Culture & Entertainment': 'সংস্কৃতি ও বিনোদন',
  'Middle East': 'মধ্যপ্রাচ্য',
  'South Asia': 'দক্ষিণ এশিয়া',
  Opinion: 'মতামত',
  Other: 'অন্যান্য',
};

export function categoryLabel(category: string): string {
  if (UI_LANG === 'en') return category;
  return CATEGORY_BN[category] ?? category;
}
