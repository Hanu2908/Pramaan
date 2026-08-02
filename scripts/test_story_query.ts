import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testStoryQuery() {
  // Fetch any evidence item that has a story_id
  const { data: item } = await supabase
    .from("evidence_items")
    .select("id, story_id")
    .not("story_id", "is", null)
    .limit(1)
    .single();

  if (!item) {
    console.log("No story_id items found yet.");
    return;
  }

  const storyId = item.story_id;
  console.log("Testing query for storyId:", storyId);

  const { data, error } = await supabase
    .from("evidence_items")
    .select(`
      id,
      headline,
      normalized_content,
      source_url,
      image_url,
      published_at,
      is_direct_record,
      entities,
      story_id,
      sources (
        id,
        name,
        type,
        authority_weight
      )
    `)
    .or(`story_id.eq.${storyId},id.eq.${storyId}`);

  if (error) {
    console.error("Query error:", error);
  } else {
    console.log(`Retrieved ${data?.length ?? 0} cluster items:`);
    data?.forEach((d: any) => {
      console.log(`- [${d.sources?.name}] ${d.headline?.slice(0, 50)} (Weight: ${d.sources?.authority_weight})`);
    });
  }
}

testStoryQuery();
