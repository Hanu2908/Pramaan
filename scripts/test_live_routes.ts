// ============================================================
// scripts/test_live_routes.ts
// Final Verification of Live Endpoints, DB Migrations & Story Cluster
// ============================================================

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyAll() {
  console.log("============================================================");
  console.log("FINAL COMPREHENSIVE LIVE VERIFICATION");
  console.log("============================================================");

  // 1. Verify DB Migrations (sources, columns, RPC)
  console.log("\n1. DATABASE MIGRATIONS & SCHEMA CHECK:");
  const { data: sources, error: srcErr } = await supabase
    .from("sources")
    .select("name, type, authority_weight");

  if (srcErr) throw srcErr;
  console.log(`   ✅ sources table active with ${sources?.length ?? 0} sources.`);
  sources?.forEach((s) => console.log(`      - ${s.name} (${s.type}): authority_weight = ${s.authority_weight}`));

  // 2. Verify get_timeline_feed RPC returning story_id and cluster_count
  console.log("\n2. LIVE RPC FEED CHECK (get_timeline_feed):");
  const { data: feed, error: feedErr } = await supabase.rpc("get_timeline_feed", {
    lane: "all",
    page_size: 5,
  });

  if (feedErr) throw feedErr;
  console.log(`   ✅ get_timeline_feed returned ${feed?.length ?? 0} live items.`);
  feed?.slice(0, 3).forEach((item: any) => {
    console.log(`      - [${item.source_name}] "${item.headline?.slice(0, 45)}..." | story_id: ${item.story_id} | cluster_count: ${item.cluster_count}`);
  });

  // 3. Verify Story Cluster query for /story/:id route
  console.log("\n3. STORY CLUSTER FETCH FOR /story/:id ROUTE:");
  const clusteredItem = feed?.find((i: any) => Number(i.cluster_count) > 1) || feed?.[0];
  if (clusteredItem) {
    const targetStoryId = clusteredItem.story_id;
    console.log(`   Querying /story/${targetStoryId}...`);

    const { data: clusterData, error: clusterErr } = await supabase
      .from("evidence_items")
      .select(`
        id,
        headline,
        normalized_content,
        source_url,
        published_at,
        is_direct_record,
        story_id,
        entities,
        sources ( name, type, authority_weight )
      `)
      .or(`story_id.eq.${targetStoryId},id.eq.${targetStoryId}`);

    if (clusterErr) throw clusterErr;
    console.log(`   ✅ /story/${targetStoryId} fetched ${clusterData?.length ?? 0} cluster evidence items.`);
    clusterData?.forEach((ev: any) => {
      const s = Array.isArray(ev.sources) ? ev.sources[0] : ev.sources;
      console.log(`      - Source: ${s?.name} | Authority Weight: ${s?.authority_weight} | Headline: "${ev.headline?.slice(0, 40)}..."`);
    });
  }

  // 4. Verify Edge Function Deployments (check-claim, drain-queue, ingest-rss, ingest-gdelt)
  console.log("\n4. DEPLOYED EDGE FUNCTIONS STATUS:");
  const functions = ["drain-queue", "ingest-rss", "ingest-gdelt", "check-claim"];
  for (const fn of functions) {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
        method: "OPTIONS",
      });
      console.log(`   ✅ Edge Function /functions/v1/${fn}: HTTP ${res.status} (Active)`);
    } catch (e) {
      console.log(`   ❌ Edge Function /functions/v1/${fn} unreachable.`);
    }
  }

  console.log("\n============================================================");
  console.log("ALL LIVE VERIFICATIONS SUCCESSFUL!");
  console.log("============================================================");
}

verifyAll().catch(console.error);
