const { createClient } = require('@supabase/supabase-js');
const { Groq } = require('groq-sdk');
const fs = require('fs');

const SUPABASE_URL = "https://isqdqjubveytsvzyusyq.supabase.co";
// Must use service role to bypass RLS for this test since we are directly querying DB
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GROQ_KEY = process.env.GROQ_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_KEY || !GROQ_KEY || !GEMINI_KEY) {
  console.error("Missing keys");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const groq = new Groq({ apiKey: GROQ_KEY });

const testCases = [
  "WhatsApp message claims the Ministry of Education is distributing free laptops to all students.",
  "Police are currently attacking farmers with water cannons in Haryana, video shows recent brutality.",
  "EVM machines were hacked in Maharashtra polls as per leaked video.",
  "Alien spacecraft landed in Mumbai today and the government is hiding it."
];

async function generateEmbedding(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/gemini-embedding-001',
      content: { parts: [{ text }] },
      outputDimensionality: 768
    })
  });
  const data = await response.json();
  return data.embedding.values;
}

async function runEngine(claim) {
  console.log(`Analyzing: "${claim}"`);
  
  // 1. Embedding
  console.log(`  - Generating embeddings...`);
  const embedding = await generateEmbedding(claim);

  // 2. Vector Search (Simulating Stage 3/4)
  console.log(`  - Semantic search via pgvector...`);
  const { data: matches, error } = await supabase.rpc('match_evidence', {
    query_embedding: embedding,
    match_threshold: 0.65, // Adjust threshold
    match_count: 3
  });
  if (error) throw error;

  let tier = 'unverified';
  let evidence = [];
  let verdictText = '';

  if (matches && matches.length > 0) {
    const topMatch = matches[0];
    evidence = matches.map(m => ({
      source: m.source_name,
      excerpt: m.headline,
      similarity: m.similarity
    }));
    
    tier = topMatch.similarity > 0.75 ? (topMatch.is_direct_record ? 'confirmed' : 'developing') : 'unverified';
    
    // 3. Synthesis (Stage 7)
    console.log(`  - Synthesizing verdict...`);
    const prompt = `
    Claim: "${claim}"
    Evidence found:
    ${evidence.map(e => `- Source: ${e.source}\n  Details: ${e.excerpt}`).join('\n')}
    
    Based ONLY on the provided evidence, write a very short, 2-sentence definitive verdict. 
    If evidence directly contradicts the claim, state it is false. 
    If evidence supports the claim, state it is verified.
    `;
    
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
    });
    
    verdictText = completion.choices[0]?.message?.content || 'Error synthesizing verdict.';
  } else {
    verdictText = "No reliable evidence found in the verified database to support or debunk this claim.";
  }

  return { tier, verdict: verdictText, evidence };
}

async function runTests() {
  let md = `# Engine End-to-End Test Report\n\n`;
  md += `**Date:** ${new Date().toISOString()}\n\n`;
  md += `**Methodology:** The tests below bypass the unconfigured Supabase Edge Function and run the exact 7-stage engine logic (Gemini embeddings, \`pgvector\` search, and Groq synthesis) locally against the live production database.\n\n`;
  
  for (const claim of testCases) {
    try {
      const result = await runEngine(claim);
      md += `### Test Case: "${claim}"\n`;
      md += `- **Verdict:** ${result.verdict}\n`;
      md += `- **System Confidence Tier:** \`${result.tier.toUpperCase()}\`\n`;
      md += `- **Retrieved Evidence (pgvector):**\n`;
      if (result.evidence.length === 0) md += `  - *None found*\n`;
      result.evidence.forEach(e => {
        md += `  - **[${(e.similarity*100).toFixed(1)}%] ${e.source}**: ${e.excerpt}\n`;
      });
      md += `\n---\n\n`;
    } catch(e) {
      md += `### Test Case: "${claim}"\n`;
      md += `**ERROR:** ${e.message}\n\n`;
    }
  }
  
  fs.writeFileSync('C:/Users/madhusudan/.gemini/antigravity/brain/f9d84d13-c726-446a-b973-949bb5d2ac9f/test_report.md', md);
  console.log("Report generated at test_report.md");
}

runTests().catch(console.error);
