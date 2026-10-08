import { describe, expect, it } from 'vitest';
import { articleImageFromHtml } from '../src/run';

describe('original article image metadata', () => {
  it('reads publisher og:image and resolves a relative image URL', () => {
    const html = '<html><head><meta property="og:image" content="/photos/story.jpg"></head></html>';
    expect(articleImageFromHtml(html, 'https://news.example.com/article/1')).toBe('https://news.example.com/photos/story.jpg');
  });
  it('works with reversed meta attribute order and single quotes', () => {
    const html = "<meta content='https://cdn.example.com/photo.webp?size=large' property='og:image'>";
    expect(articleImageFromHtml(html, 'https://news.example.com/a')).toBe('https://cdn.example.com/photo.webp?size=large');
  });
  it('falls back to twitter:image when og:image is missing', () => {
    const html = '<meta name="twitter:image" content="https://static.example.org/lead.png">';
    expect(articleImageFromHtml(html, 'https://news.example.com/a')).toBe('https://static.example.org/lead.png');
  });
  it('avoids generic site logos, placeholders and unsafe protocols', () => {
    const html = '<meta property="og:image" content="/brand/logo.png"><meta name="twitter:image" content="/photos/news.jpg">';
    expect(articleImageFromHtml(html, 'https://news.example.com/a')).toBe('https://news.example.com/photos/news.jpg');
    expect(articleImageFromHtml('<meta property="og:image" content="javascript:alert(1)">', 'https://news.example.com/a')).toBe(null);
  });
  it('decodes encoded query string parameters', () => {
    const html = '<meta property="og:image" content="https://cdn.example.com/article.jpg?w=1200&amp;h=630">';
    expect(articleImageFromHtml(html, 'https://news.example.com/a')).toBe('https://cdn.example.com/article.jpg?w=1200&h=630');
  });
});
