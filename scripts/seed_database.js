const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../pramaan-app/.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = 'https://isqdqjubveytsvzyusyq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiKey = process.env.GEMINI_API_KEY;

if (!supabaseKey || !geminiKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY or GEMINI_API_KEY");
}

const supabase = createClient(supabaseUrl, supabaseKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzcWRxanVidmV5dHN2enl1c3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxOTc4MzAsImV4cCI6MjEwMDc3MzgzMH0.NyD06h8j84FiWl00Cn0RAiIWnGEZzWt0N7k_iOPgK7k");

// --- Curated Data Across All Topics ---
const mockRecords = [
  // Government
  {
    sourceName: 'PIB', topicSlug: 'government', isDirectRecord: true,
    headline: 'Fake notification regarding free laptop distribution for students',
    content: 'A fraudulent WhatsApp message claims the Ministry of Education is distributing free laptops to all students. This is completely FAKE. The Government of India has not launched any such scheme.',
    url: 'https://factcheck.pib.gov.in/fake-laptop-scheme',
    date: new Date().toISOString()
  },
  {
    sourceName: 'PIB', topicSlug: 'government', isDirectRecord: true,
    headline: 'Cabinet approves PLI scheme expansion for semiconductor manufacturing',
    content: 'The Union Cabinet has approved a new policy to extend semiconductor production incentives to ATMP packaging facilities with an outlay of ₹22,000 crore.',
    url: 'https://pib.gov.in/PressRelease.aspx?PRID=192837',
    date: new Date(Date.now() - 86400000).toISOString()
  },

  // Protests
  {
    sourceName: 'Alt News', topicSlug: 'protests', isDirectRecord: false,
    headline: 'Old video of police lathi-charge falsely shared as recent farmer protest',
    content: 'A video showing police using water cannons and batons on crowds is circulating with claims it depicts recent farmer protests in Haryana. Alt News verified this video is actually from a 2019 protest in a different state.',
    url: 'https://www.altnews.in/old-video-police-haryana-farmers/',
    date: new Date(Date.now() - 3600000).toISOString()
  },
  {
    sourceName: 'ACLED', topicSlug: 'protests', isDirectRecord: true,
    headline: 'Peaceful demonstrations reported across Punjab over minimum support price',
    content: 'ACLED data confirms widespread but peaceful demonstrations by farmers unions across 12 districts in Punjab, demanding a legal guarantee for Minimum Support Price (MSP). No violence was reported.',
    url: 'https://acleddata.com/dashboard/punjab-protests',
    date: new Date(Date.now() - 7200000).toISOString()
  },

  // Elections
  {
    sourceName: 'Factly', topicSlug: 'elections', isDirectRecord: false,
    headline: 'Misleading claim about EVM tampering in recent state polls',
    content: 'A viral video claims to show an election official tampering with an EVM machine. Factly found the video is a mock drill conducted by the Election Commission for training purposes, explicitly marked "TRAINING ONLY" in the original uncut footage.',
    url: 'https://factly.in/evm-tampering-video-is-actually-a-mock-drill/',
    date: new Date().toISOString()
  },

  // Health
  {
    sourceName: 'PIB', topicSlug: 'health', isDirectRecord: true,
    headline: 'Health Ministry issues advisory on JN.1 subvariant resurgence in 4 states',
    content: 'PIB confirms official Ministry advisory covering Maharashtra, Kerala, Tamil Nadu, and Karnataka. No emergency declaration issued. Booster uptake recommended for 60+ and immunocompromised.',
    url: 'https://pib.gov.in/PressRelease.aspx?PRID=198273',
    date: new Date(Date.now() - 10000000).toISOString()
  },
  {
    sourceName: 'Alt News', topicSlug: 'health', isDirectRecord: false,
    headline: 'Viral clip claiming instant herbal cure for dengue is unfounded',
    content: 'A social media video claiming a papaya leaf extract recipe completely cures severe dengue in 2 hours is misleading. Medical experts confirm while papaya extract can support platelet recovery, it is not a standalone cure and medical monitoring is essential.',
    url: 'https://www.altnews.in/herbal-dengue-cure-claim-factcheck/',
    date: new Date(Date.now() - 15000000).toISOString()
  },

  // Conflict
  {
    sourceName: 'ACLED', topicSlug: 'conflict', isDirectRecord: true,
    headline: 'Fresh clashes reported in Churachandpur; ACLED records two incidents',
    content: 'Armed conflict events logged by ACLED in Churachandpur district. PIB and Alt News have not independently corroborated. Casualty figures from social media remain unverified.',
    url: 'https://acleddata.com/dashboard/manipur-clashes',
    date: new Date(Date.now() - 13000000).toISOString()
  },

  // International Conflict
  {
    sourceName: 'Alt News', topicSlug: 'international', isDirectRecord: false,
    headline: 'Video game footage passed off as real military strike in international conflict',
    content: 'A widely shared video claiming to show an air defense system intercepting missiles in a conflict zone is actually footage from the video game ARMA 3. The developers have previously warned about their simulation being misused as real combat footage.',
    url: 'https://www.altnews.in/arma3-video-game-footage-military-strike/',
    date: new Date(Date.now() - 4000000).toISOString()
  },
  {
    sourceName: 'NewsData.io', topicSlug: 'international', isDirectRecord: true,
    headline: 'UN Security Council votes on new resolution regarding border security',
    content: 'The UN Security Council passed a resolution demanding immediate cessation of hostilities in border regions. The resolution was adopted with 14 votes in favor and 1 abstention.',
    url: 'https://newsdata.io/un-ceasefire-resolution',
    date: new Date(Date.now() - 8000000).toISOString()
  },

  // Deepfake
  {
    sourceName: 'Alt News', topicSlug: 'deepfake', isDirectRecord: false,
    headline: 'Viral video claiming Indian Army withdrawal from Depsang is AI-generated',
    content: 'Reality Defender returns synthetic score of 0.94 — high confidence this is AI-generated video. No corroborating evidence from PIB or ACLED. Visual artefacts consistent with face-swap diffusion model.',
    url: 'https://www.altnews.in/ai-generated-depsang-video-factcheck/',
    date: new Date(Date.now() - 7000000).toISOString()
  },

  // Science & Tech
  {
    sourceName: 'NewsData.io', topicSlug: 'science-tech', isDirectRecord: true,
    headline: 'ISRO successfully launches NVS-02 navigation satellite from Sriharikota',
    content: 'India space agency confirms NVS-02 placed in geosynchronous transfer orbit. Second satellite in the NavIC constellation, strengthening indigenous navigation infrastructure.',
    url: 'https://newsdata.io/isro-nvs02-launch',
    date: new Date(Date.now() - 5000000).toISOString()
  },

  // Economy
  {
    sourceName: 'Factly', topicSlug: 'economy', isDirectRecord: false,
    headline: 'Claim that RBI is withdrawing 500 rupee notes with satellite GPS chip is FALSE',
    content: 'Social media posts claiming the RBI will withdraw ₹500 currency notes and replace them with nano-GPS tracking notes is completely FALSE. RBI has issued no such order.',
    url: 'https://factly.in/rbi-500-note-gps-chip-rumor-false/',
    date: new Date(Date.now() - 2000000).toISOString()
  },

  // Disaster
  {
    sourceName: 'NewsData.io', topicSlug: 'disaster', isDirectRecord: true,
    headline: 'NDRF deploys 10 rescue teams following heavy rainfall in coastal Odisha',
    content: 'The National Disaster Response Force has deployed 10 teams across vulnerable districts in coastal Odisha following IMD heavy rainfall warnings.',
    url: 'https://newsdata.io/ndrf-odisha-rain-relief',
    date: new Date(Date.now() - 9000000).toISOString()
  }
];

let topicCache = {};
let sourceCache = {};

async function fetchMetadata() {
  const { data: topics, error: tErr } = await supabase.from('topics').select('id, slug');
  if (tErr) throw tErr;
  topics.forEach(t => topicCache[t.slug] = t.id);

  const { data: sources, error: sErr } = await supabase.from('sources').select('id, name');
  if (sErr) throw sErr;
  sources.forEach(s => sourceCache[s.name] = s.id);
}

async function generateEmbedding(text) {
  if (!geminiKey) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${geminiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/gemini-embedding-001',
      content: { parts: [{ text }] },
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: 768
    })
  });
  
  const data = await response.json();
  if (!data.embedding || !data.embedding.values) {
    throw new Error(`Failed to generate embedding: ${JSON.stringify(data)}`);
  }
  return data.embedding.values;
}

async function run() {
  console.log("Fetching database metadata...");
  await fetchMetadata();

  console.log(`Seeding ${mockRecords.length} records across all categories...`);
  
  for (const record of mockRecords) {
    const topicId = topicCache[record.topicSlug] || topicCache['government'];
    const sourceId = sourceCache[record.sourceName] || sourceCache['PIB'];

    if (!sourceId) {
      console.warn(`Source not found in DB: ${record.sourceName}. Skipping.`);
      continue;
    }

    console.log(`Processing: ${record.headline}`);
    const textToEmbed = `${record.headline}\n${record.content}`;
    
    let embedding = null;
    if (geminiKey) {
      try {
        embedding = await generateEmbedding(textToEmbed);
      } catch (e) {
        console.warn(`Embedding skipped for "${record.headline}": ${e.message}`);
      }
    }

    const { error } = await supabase.from('evidence_items').insert({
      source_id: sourceId,
      topic_id: topicId,
      raw_content: record.content,
      normalized_content: record.content,
      headline: record.headline,
      source_url: record.url,
      published_at: record.date,
      is_direct_record: record.isDirectRecord,
      embedding: embedding
    });

    if (error) {
      console.error(`Failed to insert record:`, error.message);
    } else {
      console.log(`Inserted successfully.`);
    }
  }
  
  console.log("Seeding complete!");
}

run().catch(console.error);
