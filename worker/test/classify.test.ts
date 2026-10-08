import { describe, expect, it } from 'vitest';
import { CATEGORIES, classifyNews } from '../src/classify';

const cat = (title: string, summary?: string) => classifyNews(title, summary).category;

describe('classifyNews — English headlines (real-feel samples)', () => {
  const cases: Array<[string, string, string?]> = [
    ['Airstrikes hit Gaza amid ceasefire push', 'War & Conflict'],
    ['Israel and Hezbollah trade fire near the border', 'War & Conflict'],
    ['Trump signs executive order on tariffs', 'Politics'],
    ['Parliament passes election reform bill after heated debate', 'Politics'],
    ['Fed holds rates as inflation cools', 'Economy & Business'],
    ['Oil prices jump as OPEC cuts output', 'Economy & Business'],
    ['OpenAI releases a new model as AI race heats up', 'Technology'],
    ['Ransomware attack hits hospital networks across Europe', 'Technology'],
    ['Scientists find water vapour on a distant exoplanet', 'Science'],
    ['New study links air pollution to heart disease in cities', 'Climate'],
    ['Ebola outbreak spreads as health workers race to vaccinate', 'Health'],
    ['Hurricane weakens after battering the coast', 'Climate'],
    ['Manchester United appoint a new head coach', 'Sports'],
    ['Cricket match postponed after flooding in Colombo', 'Sports'],
    ['Netflix series sweeps the awards season', 'Culture & Entertainment'],
    ['Opinion: Why the West should rethink its strategy', 'Opinion'],
    ['Bangladesh announces new budget to boost exports', 'Economy & Business'],
    ['Modi arrives in Dhaka for talks on trade and security', 'South Asia'],
    ['War and economy: markets brace for conflict', 'War & Conflict'],
    ['A quiet morning in the village', 'Other'],
  ];

  for (const [title, expected, summary] of cases) {
    it(`“${title}” -> ${expected}`, () => {
      expect(cat(title, summary)).toBe(expected);
    });
  }
});

describe('classifyNews — Bengali headlines', () => {
  const cases: Array<[string, string]> = [
    ['নির্বাচনের তারিখ ঘোষণা করল নির্বাচন কমিশন', 'Politics'],
    ['যুদ্ধবিরতি নিয়ে আলোচনা শুরু', 'War & Conflict'],
    ['অর্থনীতিতে ধীরগতির প্রবৃদ্ধি, বাড়ছে মূল্যস্ফীতি', 'Economy & Business'],
    ['কৃত্রিম বুদ্ধিমত্তা নিয়ে নতুন সফটওয়্যার উন্মোচন', 'Technology'],
    ['ক্রিকেট ম্যাচ postponed নয়, মাঠে খেলা হবে', 'Sports'],
    ['জলবায়ু পরিবর্তনে বাড়ছে বন্যা', 'Climate'],
  ];
  for (const [title, expected] of cases) {
    it(`“${title}” -> ${expected}`, () => {
      expect(cat(title)).toBe(expected);
    });
  }
});

describe('word boundaries (no substring false positives)', () => {
  it('does not read "ai" inside "said"', () => {
    const r = classifyNews('He said the market fell sharply');
    expect(r.category).toBe('Economy & Business');
    expect(r.matched).not.toContain('ai');
  });
  it('does not read "war" inside "warning"', () => {
    expect(cat('Storm warning issued for coastal areas')).toBe('Climate');
  });
  it('does not read "fed" inside "federal"', () => {
    expect(classifyNews('Federal court hears the case').matched).not.toContain('fed');
  });
});

describe('scoring + priority', () => {
  it('title matches outweigh summary matches', () => {
    const r = classifyNews('Technology giant reports record results', 'The bank said inflation is easing');
    expect(r.scores['Technology']).toBeGreaterThan(r.scores['Economy & Business'] ?? 0);
    expect(r.category).toBe('Technology');
  });
  it('breaks ties with the documented priority order (War > Economy)', () => {
    const r = classifyNews('War and economy: markets brace for conflict');
    expect(r.scores['War & Conflict']).toBe(r.scores['Economy & Business']);
    expect(r.category).toBe('War & Conflict');
  });
  it('always returns one of the allowed categories', () => {
    for (const c of ['Something utterly unrelated here', 'Bângla-ish nonsense', '']) {
      expect(CATEGORIES).toContain(cat(c));
    }
  });
});
