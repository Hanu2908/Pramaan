const fs = require('fs');

async function testPibTelegramScraper() {
  console.log("Fetching live Telegram feed from https://t.me/s/PIB_FactCheck...");
  const res = await fetch("https://t.me/s/PIB_FactCheck", {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Telegram channel: ${res.status}`);
  }

  const html = await res.text();
  const posts = [];

  // Extract individual message blocks
  const messageMatches = html.matchAll(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/g);
  let count = 0;
  
  for (const match of messageMatches) {
    count++;
    let rawText = match[1];
    // Clean HTML tags and entities
    let text = rawText
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();

    if (text.length > 20) {
      // Determine headline and summary
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      const headline = lines[0].slice(0, 120);

      posts.push({
        id: `pib_tg_${count}`,
        headline: headline,
        full_text: text,
        url: `https://t.me/PIB_FactCheck/${count}`,
        scraped_at: new Date().toISOString()
      });
    }
  }

  console.log(`Successfully scraped ${posts.length} posts from @PIB_FactCheck.`);
  fs.writeFileSync('scripts/pib_telegram_posts.json', JSON.stringify(posts, null, 2));
  console.log("Saved parsed posts to scripts/pib_telegram_posts.json");
}

testPibTelegramScraper().catch(console.error);
