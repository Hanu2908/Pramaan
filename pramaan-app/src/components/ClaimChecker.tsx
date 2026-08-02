import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ArrowRight, Upload, Image as ImageIcon, Mic, FileText, X, AlertTriangle, ShieldCheck } from 'lucide-react';
import { PIPELINE_STAGES, type CheckResult } from '../data/mockData';
import { ConfidenceBadge } from './ConfidenceBadge';
import { supabase } from '../lib/supabase';

function PipelineMinimal({ currentStage, done }: { currentStage: number; done: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.4 }}
      style={{ padding: '32px 0', borderBottom: '1px solid var(--border)' }}>
      
      <p className="eyebrow" style={{ marginBottom: 24, color: done ? 'var(--confirmed)' : 'var(--text-secondary)' }}>
        {done ? 'PIPELINE COMPLETE' : 'EXECUTING FORENSICS PIPELINE...'}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        {PIPELINE_STAGES.map((stage) => {
          const isComplete = currentStage > stage.id;
          const isActive = currentStage === stage.id;
          
          return (
            <motion.div key={stage.id}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{
                paddingLeft: 12, borderLeft: `2px solid ${isActive ? 'var(--accent)' : isComplete ? 'var(--border-strong)' : 'var(--border)'}`,
                opacity: isComplete || isActive ? 1 : 0.4
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="mono" style={{ fontSize: 10, color: isActive ? 'var(--accent)' : 'var(--text-tertiary)' }}>
                  0{stage.id}
                </span>
                {isActive && (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                    <Loader2 size={12} style={{ color: 'var(--accent)' }} />
                  </motion.div>
                )}
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                {stage.label}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

function ResultForensics({ result }: { result: CheckResult }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} style={{ paddingTop: 32 }}>
      
      {/* Task 4: Deepfake Analysis Panel (Displayed alongside verification result) */}
      {result.deepfakeAnalysis && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel"
          style={{
            padding: 24,
            marginBottom: 32,
            borderLeft: `4px solid ${result.deepfakeAnalysis.is_synthetic ? 'var(--synthetic)' : 'var(--confirmed)'}`,
            background: result.deepfakeAnalysis.is_synthetic ? 'rgba(239, 68, 68, 0.06)' : 'rgba(34, 197, 94, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {result.deepfakeAnalysis.is_synthetic ? (
                <AlertTriangle size={20} style={{ color: 'var(--synthetic)' }} />
              ) : (
                <ShieldCheck size={20} style={{ color: 'var(--confirmed)' }} />
              )}
              <span className="mono" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Reality Defender Media Forensics
              </span>
            </div>

            <span
              className="mono"
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '4px 12px',
                borderRadius: 'var(--r-full)',
                background: result.deepfakeAnalysis.is_synthetic ? 'var(--synthetic)' : 'var(--confirmed)',
                color: '#FFF',
                letterSpacing: '0.05em',
              }}
            >
              {result.deepfakeAnalysis.is_synthetic ? 'FLAGGED SYNTHETIC' : 'AUTHENTIC MEDIA'}
            </span>
          </div>

          <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: 8 }}>
            {result.deepfakeAnalysis.is_synthetic
              ? `High probability of AI visual manipulation / deepfake generation (Synthetic Score: ${Math.round(result.deepfakeAnalysis.score * 100)}%). Verification against civic databases ran in parallel.`
              : `Natural visual indicators confirmed. Synthetic risk score: ${Math.round(result.deepfakeAnalysis.score * 100)}%.`}
          </p>

          <span className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
            Server-side Reality Defender API analysis · Neither result gates or replaces the other.
          </span>
        </motion.div>
      )}

      {/* Extracted Claim Text Display (for OCR / Audio inputs) */}
      {result.claimText && (
        <div style={{ marginBottom: 24, padding: '16px 20px', borderRadius: 'var(--r-sm)', background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
            Extracted / Transcribed Claim Text
          </span>
          <p style={{ fontSize: 15, color: 'var(--text-primary)', fontStyle: 'italic', margin: 0 }}>
            "{result.claimText}"
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 48 }} className="main-grid">
        
        {/* Left: Summary & Evidence */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <ConfidenceBadge tier={result.confidence} size="md" animate />
          </div>
          
          <p style={{ fontSize: 16, lineHeight: 1.8, color: 'var(--text-primary)', marginBottom: 40 }}>
            {result.summary}
          </p>

          <p className="eyebrow" style={{ marginBottom: 16 }}>Retrieved Evidence</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {result.evidence.map((ev, i) => (
              <div key={i} style={{ paddingLeft: 16, borderLeft: '1px solid var(--border-strong)' }}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>{ev.source}</span>
                <p style={{ fontSize: 14, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>"{ev.snippet}"</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Extracted Entities */}
        <div>
          <div className="glass-panel" style={{ padding: 24 }}>
            <p className="eyebrow" style={{ marginBottom: 20 }}>Stage 2: Entities</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {Object.entries(result.entities).map(([k, v]) => (
                <div key={k}>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>{k}</div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--text-primary)' }}>
                    {Array.isArray(v) ? v.join(' • ') : String(v)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
}

export function ClaimChecker() {
  const [inputType, setInputType] = useState<'text' | 'image' | 'audio'>('text');
  const [query, setQuery] = useState('');
  
  // Local base64/object URL for on-screen preview ONLY
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  // Task 1: Real File object for Supabase Storage upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const [checking, setChecking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState<CheckResult | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Task 1: Store actual File object
    setSelectedFile(file);

    // Keep local preview for on-screen display ONLY
    const reader = new FileReader();
    reader.onloadend = () => {
      setMediaPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  function clearMedia() {
    setMediaPreview(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function run() {
    if (inputType === 'text' && !query.trim()) return;
    if (inputType !== 'text' && (!selectedFile && !mediaPreview)) return;

    setResult(null); setChecking(true); setStage(0);

    const stageInterval = setInterval(() => {
      setStage(s => (s < 7 ? s + 1 : s));
    }, 400);

    try {
      let publicMediaUrl: string | null = null;

      // Task 1: Real File Upload to Supabase Storage
      if (inputType !== 'text' && selectedFile) {
        setUploading(true);
        const fileExt = selectedFile.name.split('.').pop() || (inputType === 'image' ? 'png' : 'mp3');
        const filePath = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadErr } = await supabase.storage
          .from('evidence_uploads')
          .upload(filePath, selectedFile, {
            contentType: selectedFile.type,
            upsert: true,
          });

        if (uploadErr) {
          console.warn('Supabase storage upload error, falling back to public storage bucket URL:', uploadErr);
        }

        const { data: urlData } = supabase.storage
          .from('evidence_uploads')
          .getPublicUrl(filePath);

        publicMediaUrl = urlData.publicUrl;
        setUploading(false);
      }

      const payload: Record<string, any> = { input_type: inputType };
      if (inputType === 'text') {
        payload.text = query;
      } else {
        payload.media_url = publicMediaUrl || mediaPreview;
        payload.text = query || undefined;
      }

      // Invoke check-claim Edge Function
      const { data, error } = await supabase.functions.invoke('check-claim', {
        body: payload
      });

      if (error) throw error;
      if (!data) throw new Error("No data returned from check-claim function");

      clearInterval(stageInterval);
      setStage(7);

      setResult({
        confidence: (data.tier || 'unverified').toLowerCase() as any,
        summary: data.verdict || "Claim verification complete.",
        claimText: data.claim_text,
        evidence: (data.sources || []).map((s: any) => ({
          source: s.name || "Verified Source",
          snippet: s.excerpt || ""
        })),
        entities: data.entities || {
          topic: "Retrieved via 7-Stage Matching Engine"
        },
        deepfakeAnalysis: data.deepfake_analysis || (data.synthetic_score !== null ? {
          is_synthetic: Boolean(data.synthetic_score > 0.7),
          score: Number(data.synthetic_score),
          status: data.synthetic_score > 0.7 ? "FLAGGED_SYNTHETIC" : "AUTHENTIC_MEDIA",
        } : null),
        isFallback: !!data.used_web_grounding
      });
    } catch (e: any) {
      console.error("Claim check error:", e);
      clearInterval(stageInterval);
      alert(`Error checking claim: ${e.message || "Please check connection & edge function service."}`);
      setChecking(false);
      setUploading(false);
      return;
    }

    await new Promise(r => setTimeout(r, 200));
    setChecking(false);
    setUploading(false);
  }

  const showPipeline = checking || (result !== null && stage >= 7);

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ maxWidth: 800, marginBottom: 40 }}>
        <p className="eyebrow" style={{ marginBottom: 12 }}>Reactive Forensics</p>
        
        {/* Input Mode Selector Tabs */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <button
            onClick={() => { setInputType('text'); clearMedia(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 20,
              fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-sans)',
              background: inputType === 'text' ? 'var(--text-primary)' : 'var(--bg-card)',
              color: inputType === 'text' ? 'var(--bg-base)' : 'var(--text-secondary)',
              border: '1px solid var(--border)', cursor: 'pointer'
            }}>
            <FileText size={14} /> Text Claim
          </button>

          <button
            onClick={() => { setInputType('image'); clearMedia(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 20,
              fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-sans)',
              background: inputType === 'image' ? 'var(--text-primary)' : 'var(--bg-card)',
              color: inputType === 'image' ? 'var(--bg-base)' : 'var(--text-secondary)',
              border: '1px solid var(--border)', cursor: 'pointer'
            }}>
            <ImageIcon size={14} /> Image (Groq OCR + Deepfake)
          </button>

          <button
            onClick={() => { setInputType('audio'); clearMedia(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 20,
              fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-sans)',
              background: inputType === 'audio' ? 'var(--text-primary)' : 'var(--bg-card)',
              color: inputType === 'audio' ? 'var(--bg-base)' : 'var(--text-secondary)',
              border: '1px solid var(--border)', cursor: 'pointer'
            }}>
            <Mic size={14} /> Audio Note (Whisper Turbo)
          </button>
        </div>

        {/* Input Controls */}
        {inputType === 'text' ? (
          <textarea 
            className="input-elegant" 
            rows={2}
            placeholder="Enter a claim to verify..."
            value={query} 
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(); } }}
          />
        ) : (
          <div style={{ border: '2px dashed var(--border-strong)', borderRadius: 12, padding: 24, textAlign: 'center', background: 'var(--bg-card)' }}>
            <input 
              type="file" 
              ref={fileInputRef} 
              accept={inputType === 'image' ? 'image/*' : 'audio/*'}
              onChange={handleFileSelect} 
              style={{ display: 'none' }} 
            />

            {!mediaPreview ? (
              <div style={{ cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
                <Upload size={32} style={{ color: 'var(--text-tertiary)', marginBottom: 12 }} />
                <p style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500, marginBottom: 4 }}>
                  Click to select {inputType === 'image' ? 'image / screenshot' : 'voice note'}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {inputType === 'image'
                    ? 'Runs Groq Vision OCR + Reality Defender deepfake analysis automatically.'
                    : 'Transcribes speech via Groq Whisper Turbo automatically.'}
                </p>
              </div>
            ) : (
              <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
                {inputType === 'image' ? (
                  <img src={mediaPreview} alt="Upload preview" style={{ maxHeight: 200, borderRadius: 8, objectFit: 'contain' }} />
                ) : (
                  <audio controls src={mediaPreview} style={{ marginTop: 12 }} />
                )}
                <button 
                  onClick={clearMedia}
                  style={{
                    position: 'absolute', top: -10, right: -10, background: '#EF4444', color: '#FFF',
                    borderRadius: '50%', padding: 4, cursor: 'pointer', border: 'none'
                  }}>
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        )}
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {inputType === 'text'
              ? 'Press Enter to verify. Cross-references live civic databases.'
              : 'Uploads to storage, runs extraction & forensics automatically.'}
          </span>
          <button 
            className="btn-icon" 
            onClick={run} 
            disabled={checking || uploading || (inputType === 'text' ? !query.trim() : !mediaPreview)} 
            style={{ 
              background: (inputType === 'text' ? query.trim() : mediaPreview) ? 'var(--text-primary)' : 'transparent', 
              color: (inputType === 'text' ? query.trim() : mediaPreview) ? 'var(--bg-base)' : 'var(--text-secondary)' 
            }}>
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showPipeline && <PipelineMinimal currentStage={stage} done={!checking && stage === 7} />}
      </AnimatePresence>

      <AnimatePresence>
        {result && <ResultForensics result={result} />}
      </AnimatePresence>
      
      <style>{`
        @media (max-width: 768px) {
          .main-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
