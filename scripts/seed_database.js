const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

// Ensure keys are provided
const supabaseUrl = 'https://isqdqjubveytsvzyusyq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiKey = process.env.GEMINI_API_KEY;

if (!supabaseKey || !geminiKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY or GEMINI_API_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- Curated Data (Real-World Style Records) ---
const mockRecords = [
  {
    sourceName: 'PIB Fact Check', topicSlug: 'government', isDirectRecord: true,
    headline: 'Fake notification regarding free laptop distribution for students',
    content: 'A fraudulent WhatsApp message claims the Ministry of Education is distributing free laptops to all students. This is completely FAKE. The Government of India has not launched any such scheme.',
    url: 'https://factcheck.pib.gov.in/fake-laptop-scheme',
    date: new Date().toISOString()
  },
  {
    sourceName: 'PIB', topicSlug: 'government', isDirectRecord: true,
    headline: 'Cabinet approves new agricultural export policy',
    content: 'The Union Cabinet has approved a new policy to boost agricultural exports to $60 billion by 2026. The policy focuses on removing export restrictions on organic products.',
    url: 'https://pib.gov.in/PressRelease.aspx?PRID=123456',
    date: new Date(Date.now() - 86400000).toISOString()
  },
  {
    sourceName: 'PIB Fact Check', topicSlug: 'government', isDirectRecord: true,
    headline: 'No, Aadhaar linkage is not mandatory for private bank accounts',
    content: 'A viral social media post claims that failing to link Aadhaar to private bank accounts by Friday will freeze them. This is FALSE. The RBI has clarified that Aadhaar linking is voluntary for non-DBT accounts.',
    url: 'https://factcheck.pib.gov.in/aadhaar-private-banks',
    date: new Date(Date.now() - 172800000).toISOString()
  },
  {
    sourceName: 'Alt News', topicSlug: 'protests', isDirectRecord: false,
    headline: 'Old video of police lathi-charge falsely shared as recent farmer protest',
    content: 'A video showing police using water cannons and batons on crowds is circulating with claims it depicts the ongoing farmer protests in Haryana. Alt News verified this video is actually from a 2019 protest in a different state.',
    url: 'https://www.altnews.in/old-video-police-haryana-farmers/',
    date: new Date(Date.now() - 3600000).toISOString()
  },
  {
    sourceName: 'ACLED', topicSlug: 'protests', isDirectRecord: true,
    headline: 'Peaceful demonstrations reported across Punjab over minimum support price',
    content: 'ACLED data confirms widespread but peaceful demonstrations by farmers unions across 12 districts in Punjab, demanding a legal guarantee for Minimum Support Price (MSP). No violence was reported.',
    url: 'https://acleddata.com/dashboard',
    date: new Date(Date.now() - 7200000).toISOString()
  },
  {
    sourceName: 'Alt News', topicSlug: 'protests', isDirectRecord: false,
    headline: 'Doctored image shows protest leaders meeting with foreign diplomats',
    content: 'An image going viral allegedly shows protest organizers secretly meeting with foreign ambassadors in Delhi. Analysis of the image shows it has been digitally altered; the original photograph was from a public trade summit in 2022.',
    url: 'https://www.altnews.in/doctored-image-protest-leaders-diplomats/',
    date: new Date(Date.now() - 400000000).toISOString()
  },
  {
    sourceName: 'Factly', topicSlug: 'elections', isDirectRecord: false,
    headline: 'Misleading claim about EVM tampering in recent state polls',
    content: 'A viral video claims to show an election official tampering with an EVM machine. Factly found the video is a mock drill conducted by the Election Commission for training purposes, explicitly marked "TRAINING ONLY" in the original uncut footage.',
    url: 'https://factly.in/evm-tampering-video-is-actually-a-mock-drill/',
    date: new Date().toISOString()
  },
  {
    sourceName: 'PIB Fact Check', topicSlug: 'elections', isDirectRecord: true,
    headline: 'Fake voter deletion lists circulating in Maharashtra',
    content: 'The Election Commission has debunked fake PDF lists circulating on Telegram claiming millions of voters were deleted in Maharashtra. Citizens should only verify their voter status on the official ECI portal.',
    url: 'https://factcheck.pib.gov.in/eci-fake-voter-list',
    date: new Date(Date.now() - 5000000).toISOString()
  },
  {
    sourceName: 'Alt News', topicSlug: 'elections', isDirectRecord: false,
    headline: 'False quote attributed to opposition leader regarding tax hikes',
    content: 'A graphic featuring a prominent opposition leader claims they promised to double income taxes if elected. Alt News reviewed all recent speeches and manifestos and found no such statement. The quote is fabricated.',
    url: 'https://www.altnews.in/fabricated-quote-opposition-tax-hikes/',
    date: new Date(Date.now() - 15000000).toISOString()
  },
  {
    sourceName: 'Alt News', topicSlug: 'international', isDirectRecord: false,
    headline: 'Video game footage passed off as real military strike',
    content: 'A widely shared video claiming to show an air defense system intercepting missiles in a conflict zone is actually footage from the video game ARMA 3. The developers have previously warned about their simulation being misused as real combat footage.',
    url: 'https://www.altnews.in/arma3-video-game-footage-military-strike/',
    date: new Date().toISOString()
  },
  {
    sourceName: 'NewsData.io', topicSlug: 'international', isDirectRecord: true,
    headline: 'UN Security Council votes on new ceasefire resolution',
    content: 'The UN Security Council passed a resolution demanding an immediate ceasefire. The resolution was adopted with 14 votes in favor and 1 abstention. Diplomatic efforts are ongoing to ensure compliance.',
    url: 'https://newsdata.io/un-ceasefire-resolution',
    date: new Date(Date.now() - 8000000).toISOString()
  },
  {
    sourceName: 'Factly', topicSlug: 'government', isDirectRecord: false,
    headline: 'Deepfake audio of CEO declaring bankruptcy',
    content: 'An audio clip of a major Indian bank CEO stating the bank is bankrupt is an AI-generated deepfake. The bank has filed a police complaint and released their healthy quarterly financial statements.',
    url: 'https://factly.in/bank-ceo-deepfake-audio/',
    date: new Date().toISOString()
  },
  {
    sourceName: 'Google Fact Check', topicSlug: 'government', isDirectRecord: false,
    headline: 'Claim that new currency notes have GPS tracking chips is false',
    content: 'Social media users continue to share the old rumor that new currency notes have a nano-GPS chip embedded in them to track black money. The RBI has repeatedly clarified there is no such technology in the notes.',
    url: 'https://toolbox.google.com/factcheck/gps-notes',
    date: new Date(Date.now() - 500000).toISOString()
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
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${geminiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/gemini-embedding-001',
      content: {
        parts: [{ text: text }]
      },
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

  console.log(`Seeding ${mockRecords.length} records...`);
  
  for (const record of mockRecords) {
    const topicId = topicCache[record.topicSlug] || topicCache['government'];
    const sourceId = sourceCache[record.sourceName];

    if (!sourceId) {
      console.warn(`Source not found in DB: ${record.sourceName}. Skipping.`);
      continue;
    }

    console.log(`Embedding: ${record.headline}`);
    const textToEmbed = `${record.headline}\n${record.content}`;
    
    let embedding;
    try {
      embedding = await generateEmbedding(textToEmbed);
    } catch (e) {
      console.error(`Failed to generate embedding for "${record.headline}"`, e);
      continue;
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
      console.error(`Failed to insert record in DB:`, error);
    } else {
      console.log(`Inserted successfully.`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log("Seeding complete!");
}

run().catch(console.error);
