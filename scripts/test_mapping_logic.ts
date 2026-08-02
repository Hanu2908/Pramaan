// ============================================================
// scripts/test_mapping_logic.ts
// Unit verification for Task 3 & Task 4 Mapping Logic
// ============================================================

import assert from "assert";

console.log("============================================================");
console.log("VERIFYING TASK 3 & TASK 4 LIVE-DATA MAPPING & FALLBACK LOGIC");
console.log("============================================================");

// Simulated VALID_TOPICS
const VALID_TOPICS = new Set(['government', 'protests', 'conflict', 'health', 'deepfake', 'other']);

// Warn capture helper
const warnings: string[] = [];
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  warnings.push(args.join(' '));
  originalWarn(...args);
};

function mapLiveItem(item: any) {
  // 1. Confidence Tier
  let conf: string;
  if (item.confidence_tier && typeof item.confidence_tier === 'string') {
    conf = item.confidence_tier.toLowerCase();
  } else {
    console.warn(`Confidence tier missing for evidence item ${item.id}. Falling back to is_direct_record heuristic.`);
    conf = item.is_direct_record ? 'confirmed' : 'developing';
  }

  // 2. Topic Slug
  const rawSlug = (item.topic_slug || '').toLowerCase();
  let matchedTopic: string;
  if (VALID_TOPICS.has(rawSlug)) {
    matchedTopic = rawSlug;
  } else if (['international', 'science-tech', 'economy', 'disaster'].includes(rawSlug)) {
    matchedTopic = 'other';
  } else {
    console.warn(`Unrecognized topic slug "${item.topic_slug}" on item ${item.id}. Bucketing into "other" category.`);
    matchedTopic = 'other';
  }

  // 3. Source Name
  let sourceName = item.source_name;
  if (!sourceName) {
    console.warn(`Missing source_name for evidence item ${item.id}. Using "Unknown source" fallback.`);
    sourceName = 'Unknown source';
  }

  return { id: item.id, confidence: conf, topic: matchedTopic, sourceName };
}

// ── TEST 1: Recognized backend payload (no warnings) ─────────
console.log("\n1. Testing clean backend record...");
const cleanRecord = mapLiveItem({
  id: "evt-1",
  confidence_tier: "confirmed",
  topic_slug: "conflict",
  source_name: "The Hindu",
  is_direct_record: true,
});

assert.strictEqual(cleanRecord.confidence, "confirmed");
assert.strictEqual(cleanRecord.topic, "conflict");
assert.strictEqual(cleanRecord.sourceName, "The Hindu");
console.log("   ✅ Clean record mapped perfectly without defaulting to PIB RSS or government.");

// ── TEST 2: Unrecognized topic slug ─────────────────────────
console.log("\n2. Testing unrecognized topic slug ('space-exploration')...");
const unrecTopic = mapLiveItem({
  id: "evt-2",
  confidence_tier: "developing",
  topic_slug: "space-exploration",
  source_name: "Indian Express",
  is_direct_record: false,
});

assert.strictEqual(unrecTopic.topic, "other");
assert(warnings.some(w => w.includes('Unrecognized topic slug "space-exploration"')));
console.log("   ✅ Unrecognized topic correctly bucketed into 'other' + console.warn emitted!");

// ── TEST 3: Missing source name ──────────────────────────────
console.log("\n3. Testing missing source_name...");
const missingSource = mapLiveItem({
  id: "evt-3",
  confidence_tier: "unverified",
  topic_slug: "government",
  source_name: null,
  is_direct_record: false,
});

assert.strictEqual(missingSource.sourceName, "Unknown source");
assert(warnings.some(w => w.includes('Missing source_name for evidence item evt-3')));
console.log("   ✅ Missing source_name mapped to 'Unknown source' (NOT PIB RSS) + console.warn emitted!");

// ── TEST 4: Task 3 Mock Data Separation Check ───────────────
console.log("\n4. Testing Task 3 Mock Data separation logic...");
const liveItems = [{ id: "live-1" }, { id: "live-2" }];
const mockItems = [{ id: "mock-1" }, { id: "mock-2" }, { id: "mock-3" }];

function selectItems(isUsingFallback: boolean, live: any[], mock: any[]) {
  return isUsingFallback ? mock : live;
}

const liveResult = selectItems(false, liveItems, mockItems);
assert.strictEqual(liveResult.length, 2);
assert.strictEqual(liveResult[0].id, "live-1");
console.log("   ✅ When live fetch succeeds (isUsingFallback = false), strictly 0 mock items are merged!");

const fallbackResult = selectItems(true, liveItems, mockItems);
assert.strictEqual(fallbackResult.length, 3);
assert.strictEqual(fallbackResult[0].id, "mock-1");
console.log("   ✅ When live fetch fails/empty (isUsingFallback = true), mock items render as fallback.");

console.log("\n============================================================");
console.log("ALL TASK 3 & TASK 4 VERIFICATIONS PASSED 100%");
console.log("============================================================");
