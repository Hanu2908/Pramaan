// scrape_pib_telegram.js
//
// Scrapes the PUBLIC web preview of PIB Fact Check's Telegram channel.
// No API key, no bot token needed — t.me/s/<channel> is server-rendered HTML.
//
// Run:   node scrape_pib_telegram.js
// Needs: Node 18+ (built-in fetch). No npm install required.
//
// Output: prints a JSON array of { headline, content, url, postId, isFake }
// to stdout, and also writes it to pib_telegram_posts.json

const CHANNEL_URL = "https://t.me/s/PIB_FactCheck"; // correct channel — underscore, capital letters

// Keywords PIB Fact Check consistently uses to mark a claim as false.
// Used only to tag isFake for your own review — always eyeball the results.
const FAKE_MARKERS = [
  "fake", "false", "misleading", "hoax", "not true", "does not",
  "has not", "no such", "❌",
];

function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function scrape() {
  const res = await fetch(CHANNEL_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();

  // Each message is wrapped in a div with class "tgme_widget_message" and a
  // data-post="PIB_FactCheck/12345" attribute. Text lives inside
  // "tgme_widget_message_text js-message_text".
  const messageBlocks = [
    ...html.matchAll(
      /<div class="tgme_widget_message[^"]*"\s+data-post="([^"]+)"[\s\S]*?(?=<div class="tgme_widget_message[^"]*"\s+data-post=|$)/g
    ),
  ];

  const posts = [];

  for (const block of messageBlocks) {
    const fullBlock = block[0];
    const postId = block[1]; // e.g. "PIB_FactCheck/12345"

    const textMatch = fullBlock.match(
      /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/
    );
    if (!textMatch) continue; // skip image/video-only posts with no caption

    const rawText = textMatch[1];
    const content = stripHtml(rawText);
    if (!content) continue;

    const headline = content.split("\n")[0].slice(0, 200);
    const url = `https://t.me/${postId}`;
    const isFake = FAKE_MARKERS.some((kw) =>
      content.toLowerCase().includes(kw)
    );

    posts.push({ postId, headline, content, url, isFake });
  }

  return posts;
}

scrape()
  .then((posts) => {
    console.log(JSON.stringify(posts, null, 2));
    console.error(`\nScraped ${posts.length} posts from ${CHANNEL_URL}`);
    const fs = require("fs");
    fs.writeFileSync(
      "pib_telegram_posts.json",
      JSON.stringify(posts, null, 2)
    );
    console.error("Saved to pib_telegram_posts.json");
  })
  .catch((err) => {
    console.error("Scrape failed:", err.message);
    process.exit(1);
  });
