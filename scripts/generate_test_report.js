const { createClient } = require('@supabase/supabase-js');
const { Groq } = require('groq-sdk');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../pramaan-app/.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://isqdqjubveytsvzyusyq.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzcWRxanVidmV5dHN2enl1c3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxOTc4MzAsImV4cCI6MjEwMDc3MzgzMH0.NyD06h8j84FiWl00Cn0RAiIWnGEZzWt0N7k_iOPgK7k";
const GROQ_KEY = process.env.GROQ_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_KEY || !GROQ_KEY || !GEMINI_KEY) {
  console.error("Missing SUPABASE_KEY, GROQ_API_KEY, or GEMINI_API_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const groq = GROQ_KEY ? new Groq({ apiKey: GROQ_KEY }) : null;

const testCases = [
  "WhatsApp message claims the Ministry of Education is distributing free laptops to all students.",
  "Police are currently attacking farmers with water cannons in Haryana, video shows recent brutality.",
  "EVM machines were hacked in Maharashtra polls as per leaked video.",
  "Alien spacecraft landed in Mumbai today and the government is hiding it."
];

async function generateEmbedding(text) {
  if (!text || !text.trim()) return null;
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
  if (!data || !data.embedding || !data.embedding.values) {
    throw new Error(`Embedding generation error: ${JSON.stringify(data.error || data)}`);
  }
  return data.embedding.values;
}

async function runEngine(claim) {
  console.log(`Analyzing: "${claim}"`);
  
  // 1. Embedding
  console.log(`  - Generating embeddings...`);
  const embedding = await generateEmbedding(claim);

  // 2. Vector Search (Stage 4)
  console.log(`  - Semantic search via pgvector...`);
  const { data: matches, error } = await supabase.rpc('match_evidence', {
    query_embedding: embedding,
    match_threshold: 0.55,
    match_count: 5
  });
  if (error) throw error;

  let tier = 'unverified';
  let evidence = [];
  let verdictText = '';

  if (matches && matches.length > 0) {
    const topMatch = matches[0];
    evidence = matches.map(m => ({
      source: m.source_name || m.source_id || 'Verified Source',
      excerpt: m.headline,
      similarity: m.similarity
    }));

    const textCheck = (topMatch.headline + " " + topMatch.normalized_content).toLowerCase();
    const isRefuted = ["fake", "false", "hoax", "busted", "debunked", "untrue"].some(k => textCheck.includes(k));

    if (isRefuted) {
      tier = 'refuted';
    } else {
      tier = topMatch.similarity > 0.75 ? (topMatch.is_direct_record ? 'confirmed' : 'developing') : 'unverified';
    }
    
    // 3. Synthesis (Stage 7)
    if (groq) {
      console.log(`  - Synthesizing verdict...`);
      const prompt = `
      Claim: "${claim}"
      Evidence found:
      ${evidence.map(e => `- Source: ${e.source}\n  Details: ${e.excerpt}`).join('\n')}
      
      Based ONLY on the provided evidence, write a very short, 2-sentence definitive verdict. 
      If evidence directly contradicts the claim, state it is false/refuted. 
      If evidence supports the claim, state it is confirmed.
      `;
      
      const completion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.3-70b-versatile",
        temperature: 0.1,
      });
      
      verdictText = completion.choices[0]?.message?.content || 'Verdict generated.';
    } else {
      verdictText = isRefuted ? "Evidence retrieved indicates this claim is false/debunked." : "Matched evidence found in database.";
    }
  } else {
    tier = 'no_record';
    verdictText = "No reliable evidence found in the verified database to support or debunk this claim.";
  }

  return { tier, verdict: verdictText, evidence };
}

async function runTests() {
  let md = `# Engine End-to-End Test Report\n\n`;
  md += `**Date:** ${new Date().toISOString()}\n\n`;
  md += `**Methodology:** Evaluated against live database with updated match_evidence RPC (including source_name JOIN) and REFUTED tier classification.\n\n`;
  
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
  
  const reportPath = path.join(__dirname, 'test_report.md');
  fs.writeFileSync(reportPath, md);
  console.log(`Report generated at ${reportPath}`);
}

runTests().catch(console.error);
