import type { FeedSourceRow, NewsItem, ScrapeLogRow } from './types';

/**
 * Sample rows used only when Supabase env vars are missing (local preview,
 * screenshot mode). Headlines are illustrative shapes of what the worker
 * ingests; timestamps are generated relative to "now" so the demo always
 * looks fresh.
 */
const minutes = (n: number) => new Date(Date.now() - n * 60_000).toISOString();

type Seed = [title: string, source: string, category: string, summary: string, ago: number, website: string, author?: string];

const SEEDS: Seed[] = [
  [
    'The White House and the Market Are Telling Different Stories',
    'The Atlantic',
    'Politics',
    'The Treasury secretary is projecting confidence while struggling to get borrowing costs down.',
    42,
    'https://www.theatlantic.com',
    'Will Gottsegen',
  ],
  [
    '74,250 Palestinians killed in Gaza since Oct. 7, 2023, health ministry says',
    'Drop Site News',
    'War & Conflict',
    'The figure was released as aid groups warned that fuel and medical supplies are running out again in the north.',
    18,
    'https://www.dropsitenews.com',
  ],
  [
    "Britain renames East Jerusalem mission to 'U.K. Mission, Jerusalem'",
    'Haaretz (World)',
    'Middle East',
    'The diplomatic relabelling follows months of debate inside the Foreign Office over the status of the consulate.',
    96,
    'https://www.haaretz.com',
  ],
  [
    'China races to build data centres in bid for AI supremacy',
    'Financial Times',
    'Technology',
    'Beijing is rolling out computing infrastructure at breakneck speed in Inner Mongolia.',
    210,
    'https://www.ft.com',
  ],
  [
    'TSMC September revenue jumps 54.6% as AI chip demand fuels growth',
    'Anadolu Agency',
    'Economy & Business',
    'The Taiwanese chipmaker said monthly revenue reached its highest level this year on continued demand for advanced nodes.',
    130,
    'https://www.aa.com.tr/en',
  ],
  [
    'French PM Lecornu denies police crackdown as student protests spread',
    'RFI',
    'Politics',
    'The prime minister said security forces acted proportionately as walkouts reached a third week.',
    64,
    'https://www.rfi.fr/en',
  ],
  [
    'How Indonesians Are Being Recruited Into the Russian Army',
    'The Diplomat',
    'War & Conflict',
    'Recruitment networks are promising citizenship and salaries, families say, while Jakarta says it has opened an inquiry.',
    320,
    'https://thediplomat.com',
  ],
  [
    'Kenya records first Ebola case from Congo outbreak that has killed thousands',
    'The Washington Post',
    'Health',
    'Health officials activated contact tracing across three counties and asked neighbouring states to boost surveillance.',
    150,
    'https://www.washingtonpost.com',
  ],
  [
    'Spain’s leader pins political survival on public anger over flood response',
    'The Wall Street Journal',
    'Politics',
    'The prime minister is betting that voters will reward recovery spending rather than punish earlier warnings failures.',
    385,
    'https://www.wsj.com',
  ],
  [
    'From Iran to the U.K., Trump Is Being Forced Into Retreat',
    'The New York Times',
    'World',
    'Allies and adversaries alike are testing the limits of American pressure in a dozen theatres at once.',
    58,
    'https://www.nytimes.com',
  ],
  [
    'Cartoon: Democracy v autocracy',
    'The Economist',
    'Opinion',
    'Our weekly cartoon on the state of democratic governance around the world.',
    1_020,
    'https://www.economist.com',
  ],
  [
    "Cristiano Ronaldo pays tribute to Lionel Messi after Argentina's trophy night",
    'Al Jazeera',
    'Sports',
    'The two rivals exchanged rare public praise after a final that drew record viewing figures.',
    26,
    'https://www.aljazeera.com',
  ],
  [
    'The Two Africas',
    'Foreign Affairs',
    'World',
    'A new book argues that the continent’s diverging trajectories are less about resources than about institutions.',
    1_440,
    'https://www.foreignaffairs.com',
  ],
  [
    'Israeli settlers beat AFP photographer covering violence in West Bank',
    'Middle East Eye',
    'Middle East',
    'The journalist was treated in hospital; press freedom groups demanded an investigation.',
    88,
    'https://www.middleeasteye.net',
  ],
  [
    'Volkswagen board approves 35,000 job cuts in Germany by 2030',
    'Financial Times',
    'Economy & Business',
    'The plan, agreed after marathon talks with unions, shifts production towards electric platforms.',
    275,
    'https://www.ft.com',
  ],
  [
    'India’s Supreme Court orders emergency air quality plan for Delhi',
    'The Diplomat',
    'Climate',
    'Judges gave authorities two weeks to publish a winter action plan as pollution readings spiked.',
    500,
    'https://thediplomat.com',
  ],
  [
    'Ransomware attack forces hospitals in three European countries to cancel surgery',
    'POLITICO',
    'Technology',
    'Health ministries activated emergency protocols as investigators traced the intrusion to a shared billing vendor.',
    33,
    'https://www.politico.com',
  ],
  [
    'Malaysia promises Myanmar help toward full ASEAN reintegration',
    'Daily Sabah',
    'World',
    'Kuala Lumpur said it would push for a broader roadmap during the next foreign ministers’ meeting.',
    610,
    'https://www.dailysabah.com',
  ],
  [
    'CDC monitoring Russian plague risk, says it is “prepared” for any threat',
    'Axios',
    'Health',
    'Agency officials said surveillance had been stepped up after reports of a suspected outbreak.',
    47,
    'https://www.axios.com',
  ],
  [
    'Google unveils long-awaited Gemini 4 with on-device features',
    'Axios',
    'Technology',
    'The model ships in four sizes, including a compact version the company says runs entirely on phones.',
    12,
    'https://www.axios.com',
  ],
  [
    'Arab students say Israeli university failed to quell fears of campus unrest',
    'Haaretz (Middle East)',
    'Middle East',
    'Students described a tense start to term as administrators tightened rules on demonstrations.',
    205,
    'https://www.haaretz.com',
  ],
  [
    'Opinion: The case for a smaller, sharper NATO',
    'Foreign Affairs',
    'Opinion',
    'Alliances survive on credibility, not on membership certificates — and credibility is now the scarce resource.',
    730,
    'https://www.foreignaffairs.com',
  ],
  [
    'Cricket: Sri Lanka seal series win in Dhaka thriller',
    'Al Jazeera',
    'Sports',
    'A last-over finish handed the tourists a 2-1 series victory in front of a full house.',
    95,
    'https://www.aljazeera.com',
  ],
  [
    'Asteroid sample suggests water arrived on Earth earlier than thought',
    'The New York Times',
    'Science',
    'Analysis of grains returned by a probe points to liquid water in the inner solar system far earlier than models assumed.',
    1_260,
    'https://www.nytimes.com',
  ],
  [
    'Venice floods again as Adriatic surge tests new barriers',
    'Daily Sabah',
    'Climate',
    'Engineers raised the lagoon gates for the fourth time this month as tide levels breached 130cm.',
    350,
    'https://www.dailysabah.com',
  ],
  [
    'Berlin film festival unveils a lineup heavy on documentary',
    'RFI',
    'Culture & Entertainment',
    'Organisers said the selection reflects a year of conflict reporting and migration stories.',
    1_600,
    'https://www.rfi.fr/en',
  ],
];

export function demoNews(): NewsItem[] {
  return SEEDS.map(([title, source, category, summary, ago, website, author], index) => ({
    id: `demo-${index + 1}`,
    title,
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80),
    link: website,
    source_name: source,
    source_url: website,
    category,
    summary,
    image_url: null,
    author: author ?? null,
    published_at: minutes(ago),
    created_at: minutes(ago),
  })).sort((a, b) => Date.parse(b.published_at ?? '') - Date.parse(a.published_at ?? ''));
}

export function demoFeedSources(): FeedSourceRow[] {
  const sources: Array<[string, string, number | null]> = [
    ['Al Jazeera', 'https://www.aljazeera.com/xml/rss/all.xml', 25],
    ['Anadolu Agency', 'https://www.aa.com.tr/en/rss/default?cat=live', 24],
    ['Axios', 'https://api.axios.com/feed/', 3],
    ['Daily Sabah', 'https://www.dailysabah.com/rssFeed/rss.xml', 5],
    ['Drop Site News', 'https://dropsitenews.substack.com/feed', 51],
    ['Financial Times', 'https://www.ft.com/rss/home', 7],
    ['Foreign Affairs', 'https://www.foreignaffairs.com/rss.xml', 44],
    ['Haaretz (Middle East)', 'https://www.haaretz.com/srv/middle-east-news-rss', 2],
    ['Haaretz (World)', 'https://www.haaretz.com/srv/world-news-rss', 4],
    ['Middle East Eye', 'https://www.middleeasteye.net/rss', 11],
    ['POLITICO', 'https://rss.politico.com/politics-news.xml', 9],
    ['RFI', 'https://www.rfi.fr/en/rss', 6],
    ['The Atlantic', 'https://www.theatlantic.com/feed/all/', 14],
    ['The Diplomat', 'https://thediplomat.com/feed/', 13],
    ['The Economist', 'https://www.economist.com/the-world-this-week/rss.xml', 320],
    ['The New York Times', 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', 15],
    ['The Wall Street Journal', 'https://feeds.content.dowjones.io/public/rss/RSSWorldNews', 8],
    ['The Washington Post', 'https://feeds.washingtonpost.com/rss/world', 62],
  ];
  return sources.map(([name, feed_url, minutesAgo]) => ({
    name,
    feed_url,
    website_url: null,
    is_active: true,
    last_checked_at: minutesAgo === null ? null : minutes(minutesAgo),
    last_success_at: minutesAgo === null ? null : minutes(minutesAgo),
    last_error: name === 'Haaretz (World)' ? null : null,
  }));
}

export function demoScrapeLogs(): ScrapeLogRow[] {
  const rows: ScrapeLogRow[] = [];
  const sources = demoFeedSources();
  let id = 1;
  for (let run = 0; run < 2; run++) {
    for (const source of sources) {
      const ago = 12 + run * 30;
      rows.push({
        id: id++,
        run_id: `demo-run-${run + 1}`,
        trigger: 'cron',
        source_name: source.name,
        feed_url: source.feed_url,
        status: source.name === 'POLITICO' && run === 0 ? 'error' : 'success',
        http_status: source.name === 'POLITICO' && run === 0 ? 403 : 200,
        items_found: 20 + ((id * 7) % 40),
        items_inserted: run === 0 ? 0 : (id % 4),
        error_message: source.name === 'POLITICO' && run === 0 ? 'HTTP 403 Forbidden (retried once)' : null,
        duration_ms: 120 + ((id * 37) % 900),
        created_at: minutes(ago),
      });
    }
  }
  return rows.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}
