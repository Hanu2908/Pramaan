const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../pramaan-app/.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = "https://isqdqjubveytsvzyusyq.supabase.co/functions/v1/check-claim";
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzcWRxanVidmV5dHN2enl1c3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxOTc4MzAsImV4cCI6MjEwMDc3MzgzMH0.NyD06h8j84FiWl00Cn0RAiIWnGEZzWt0N7k_iOPgK7k";

const testCases = [
  "WhatsApp message claims the Ministry of Education is distributing free laptops to all students.",
  "Police are currently attacking farmers with water cannons in Haryana, video shows recent brutality.",
  "Alien spacecraft landed in Mumbai today and the government is hiding it."
];

async function runTests() {
  console.log("Starting End-to-End Live Remote Edge Function Tests...\n");
  
  for (let i = 0; i < testCases.length; i++) {
    const claim = testCases[i];
    console.log(`Test ${i + 1}: "${claim}"`);
    console.log(`Status: Calling Live Edge Function at ${SUPABASE_URL}...`);
    
    try {
      const start = Date.now();
      const response = await fetch(SUPABASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ANON_KEY}`
        },
        body: JSON.stringify({ text: claim })
      });
      
      const duration = Date.now() - start;
      const data = await response.json();
      
      if (!response.ok) {
        console.error(`❌ HTTP Error ${response.status}:`, data);
      } else {
        console.log(`✅ Success (${duration}ms)`);
        console.log(`   Tier: ${data.tier}`);
        console.log(`   Verdict: ${data.verdict}`);
        if (data.sources && data.sources.length > 0) {
          console.log(`   Top Source matched: ${data.sources[0].name} (Score: ${data.sources[0].similarity})`);
        } else {
          console.log(`   No sources matched.`);
        }
      }
    } catch (e) {
      console.error(`❌ Failed:`, e.message);
    }
    console.log("\n--------------------------------------------------\n");
  }
}

runTests();
