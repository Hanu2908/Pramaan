const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../pramaan-app/.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = "https://isqdqjubveytsvzyusyq.supabase.co";
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzcWRxanVidmV5dHN2enl1c3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxOTc4MzAsImV4cCI6MjEwMDc3MzgzMH0.NyD06h8j84FiWl00Cn0RAiIWnGEZzWt0N7k_iOPgK7k";

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function verify() {
  console.log("=======================================================");
  console.log("🔍 VERIFYING LIVE REMOTE SUPABASE DB (isqdqjubveytsvzyusyq)");
  console.log("=======================================================\n");

  // 1. Verify Topics in DB
  console.log("1. Checking DB Topics (`public.topics`)...");
  const { data: topics, error: topicsErr } = await supabase.from('topics').select('slug, name');
  if (topicsErr) {
    console.error("   ❌ Error fetching topics:", topicsErr.message);
  } else {
    console.log("   ✅ DB Topics found:", topics);
  }

  // 2. Verify get_timeline_feed RPC Output
  console.log("\n2. Calling `get_timeline_feed` RPC...");
  const { data: feed, error: feedErr } = await supabase.rpc('get_timeline_feed', { page_size: 5 });
  if (feedErr) {
    console.error("   ❌ Error calling get_timeline_feed:", feedErr.message);
  } else {
    console.log(`   ✅ get_timeline_feed returned ${feed.length} items.`);
    if (feed.length > 0) {
      console.log("   Sample Returned Item Structure:", {
        id: feed[0].id,
        headline: feed[0].headline,
        topic_slug: feed[0].topic_slug,
        topic_name: feed[0].topic_name,
        source_name: feed[0].source_name,
        is_direct_record: feed[0].is_direct_record,
        entities: feed[0].entities // See if entities exists
      });
    }
  }

  // 3. Verify evidence_items table count
  console.log("\n3. Checking `evidence_items` table...");
  const { count, error: countErr } = await supabase.from('evidence_items').select('*', { count: 'exact', head: true });
  if (countErr) {
    console.error("   ❌ Error fetching count:", countErr.message);
  } else {
    console.log(`   ✅ Total evidence_items in DB: ${count}`);
  }

  console.log("\n=======================================================\n");
}

verify().catch(console.error);
