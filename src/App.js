import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// ==================== CONFIGURATION ====================
const PROJECT_LENGTH = 15840;
const MOB_DAYS = 14;
const MOB_COST = 25000;
const DEFAULT_BUFFER = 5;
const INDIRECT_RATE = 0.30;
const PROFIT_RATE = 0.05;
const TARGET_DAYS = 55;
const TARGET_COST = 550000;
const GOOGLE_SCRIPT_URL = 'YOUR_GOOGLE_SCRIPT_URL_HERE';

const CREWS = {
  exc: { rate: 220, cost: 1600, name: 'Excavation & Bedding', equipment: 'Excavator' },
  pipe: { rate: 180, cost: 2500, name: 'Pipe Laying & Alignment', equipment: 'Mobile Crane' },
  back: { rate: 250, cost: 2300, name: 'Backfill & Compaction', equipment: 'Excavator + Compactor' },
};

const EQUIPMENT = {
  exc: [
    { name: 'Small Excavator', rate: 165, cost: 900 },
    { name: 'Standard Excavator', rate: 220, cost: 1600 },
    { name: 'Large Excavator', rate: 330, cost: 2400 },
  ],
  pipe: [
    { name: 'Standard Mobile Crane', rate: 180, cost: 2500 },
    { name: 'Heavy Mobile Crane', rate: 270, cost: 3200 },
  ],
  back: [
    { name: 'Small Backfill Set', rate: 180, cost: 1400 },
    { name: 'Standard Backfill Set', rate: 250, cost: 2300 },
    { name: 'Large Backfill Set', rate: 375, cost: 3000 },
  ],
};

const KNOWLEDGE_QUESTIONS = [
  { id: 'K1', question: 'What is the correct sequence of pipeline construction activities?', options: [{ value: 'a', label: 'Backfill → Pipe Laying → Excavation' }, { value: 'b', label: 'Pipe Laying → Excavation → Backfill' }, { value: 'c', label: 'Excavation → Pipe Laying → Backfill' }, { value: 'd', label: 'Any order works' }], correct: 'c' },
  { id: 'K2', question: 'In a Line of Balance (LOB) chart, what does a steeper slope indicate?', options: [{ value: 'a', label: 'Slower production rate' }, { value: 'b', label: 'Faster production rate' }, { value: 'c', label: 'Higher cost' }, { value: 'd', label: 'Longer duration' }], correct: 'b' },
  { id: 'K3', question: 'What does it mean when two LOB lines cross each other?', options: [{ value: 'a', label: 'Activities are on schedule' }, { value: 'b', label: 'A conflict exists (crews at same location)' }, { value: 'c', label: 'Buffer is too large' }, { value: 'd', label: 'Project is complete' }], correct: 'b' },
  { id: 'K4', question: 'What is the primary purpose of a buffer in LOB scheduling?', options: [{ value: 'a', label: 'Increase project cost' }, { value: 'b', label: 'Make the chart look better' }, { value: 'c', label: 'Prevent crew conflicts and provide safety margin' }, { value: 'd', label: 'Reduce equipment needs' }], correct: 'c' },
  { id: 'K5', question: 'If you increase the buffer size between activities, what happens to project duration?', options: [{ value: 'a', label: 'Duration decreases' }, { value: 'b', label: 'Duration increases' }, { value: 'c', label: 'Duration stays the same' }, { value: 'd', label: 'Duration becomes unpredictable' }], correct: 'b' },
  { id: 'K6', question: 'If you increase the buffer size between activities, what happens to total cost?', options: [{ value: 'a', label: 'Cost increases' }, { value: 'b', label: 'Cost decreases' }, { value: 'c', label: 'Cost stays the same' }, { value: 'd', label: 'Cost becomes unpredictable' }], correct: 'c' },
  { id: 'K7', question: 'If you use faster equipment (higher production rate), what happens to duration?', options: [{ value: 'a', label: 'Duration decreases' }, { value: 'b', label: 'Duration increases' }, { value: 'c', label: 'Duration stays the same' }, { value: 'd', label: 'Duration becomes unpredictable' }], correct: 'a' },
  { id: 'K8', question: 'How do you calculate activity duration from project length and production rate?', options: [{ value: 'a', label: 'Duration = Project Length × Rate' }, { value: 'b', label: 'Duration = Rate ÷ Project Length' }, { value: 'c', label: 'Duration = Project Length ÷ Rate (rounded up)' }, { value: 'd', label: 'Duration = Project Length - Rate' }], correct: 'c' },
];

const SELF_EFFICACY_QUESTIONS = [
  { id: 'SE1', question: 'Calculate activity durations from production rates' },
  { id: 'SE2', question: 'Identify scheduling conflicts using Line of Balance (LOB)' },
  { id: 'SE3', question: 'Apply buffers correctly to prevent crew conflicts' },
  { id: 'SE4', question: 'Optimize a schedule to meet both duration and cost constraints' },
];

const EXPERIENCE_QUESTIONS = [
  { id: 'EX1', question: 'The game helped me understand LOB scheduling concepts' },
  { id: 'EX2', question: 'The visual feedback (bar charts, LOB charts) was helpful for learning' },
  { id: 'EX3', question: 'The difficulty level of the game was appropriate' },
  { id: 'EX4', question: 'I would recommend this game to other students' },
  { id: 'EX5', question: 'The game was engaging and kept my attention' },
  { id: 'EX6', question: 'I learned something new from playing this game' },
];

const DURATIONS = {
  exc: Math.ceil(PROJECT_LENGTH / CREWS.exc.rate),
  pipe: Math.ceil(PROJECT_LENGTH / CREWS.pipe.rate),
  back: Math.ceil(PROJECT_LENGTH / CREWS.back.rate),
};

const getPositionAtDay = (startDay, rate, currentDay) => {
  if (currentDay < startDay) return 0;
  return Math.min((currentDay - startDay + 1) * rate, PROJECT_LENGTH);
};

const calculateKnowledgeScore = (answers) => KNOWLEDGE_QUESTIONS.reduce((score, q) => score + (answers[q.id] === q.correct ? 1 : 0), 0);

const calculateMeanScore = (answers, questions) => {
  const values = questions.map(q => answers[q.id] || 0).filter(v => v > 0);
  return values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : '0.00';
};

const submitToGoogleSheets = async (type, data) => {
  if (GOOGLE_SCRIPT_URL === 'YOUR_GOOGLE_SCRIPT_URL_HERE') {
    console.log('[DEV] Would submit:', type, data);
    return { success: true };
  }
  try {
    await fetch(GOOGLE_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ type, ...data }) });
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false };
  }
};

// ==================== PRE-SURVEY ====================
function PreSurvey({ onComplete, sessionId }) {
  const [step, setStep] = useState(1);
  const [demographics, setDemographics] = useState({ studentId: '', name: '', program: '', major: '', priorCourses: '', lobFamiliarity: '' });
  const [knowledge, setKnowledge] = useState({});
  const [selfEfficacy, setSelfEfficacy] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const isDemoComplete = demographics.studentId && demographics.name && demographics.program && demographics.major && demographics.priorCourses && demographics.lobFamiliarity;
  const isKnowComplete = KNOWLEDGE_QUESTIONS.every(q => knowledge[q.id]);
  const isSEComplete = SELF_EFFICACY_QUESTIONS.every(q => selfEfficacy[q.id]);

  const handleSubmit = async () => {
    setSubmitting(true);
    const data = { sessionId, timestamp: new Date().toISOString(), ...demographics, knowledge, knowledgeScore: calculateKnowledgeScore(knowledge), selfEfficacy, seScore: calculateMeanScore(selfEfficacy, SELF_EFFICACY_QUESTIONS) };
    await submitToGoogleSheets('pre-survey', data);
    onComplete({ demographics, knowledge, knowledgeScore: data.knowledgeScore, selfEfficacy, seScore: data.seScore });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 p-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center text-white mb-6"><h1 className="text-3xl font-bold">📋 Pre-Game Survey</h1><p className="text-blue-200">Please complete before starting the game</p></div>
        
        <div className="bg-white rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between text-sm">
            {[{n:1,t:'About You'},{n:2,t:'Knowledge'},{n:3,t:'Confidence'}].map((s,i) => (
              <React.Fragment key={s.n}>
                <div className={`flex items-center gap-2 ${step >= s.n ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= s.n ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>{s.n}</span>{s.t}
                </div>
                {i < 2 && <div className="flex-1 h-1 mx-2 bg-gray-200"><div className={`h-full bg-blue-600 transition-all ${step > s.n ? 'w-full' : 'w-0'}`} /></div>}
              </React.Fragment>
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="bg-white rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-blue-900 border-b pb-2">Section 1: About You</h2>
            <div><label className="block text-sm font-medium mb-1">Student ID (UIN) *</label><input type="text" value={demographics.studentId} onChange={e => setDemographics({...demographics, studentId: e.target.value})} className="w-full px-3 py-2 border-2 rounded-lg" placeholder="Enter student ID" /></div>
            <div><label className="block text-sm font-medium mb-1">Your Name *</label><input type="text" value={demographics.name} onChange={e => setDemographics({...demographics, name: e.target.value})} className="w-full px-3 py-2 border-2 rounded-lg" placeholder="Enter name" /></div>
            <div><label className="block text-sm font-medium mb-1">Academic Program *</label>
              <div className="space-y-2">{['Undergraduate', "Master's", 'PhD', 'Other'].map(o => (
                <label key={o} className={`block p-3 rounded-lg border-2 cursor-pointer ${demographics.program === o ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                  <input type="radio" name="program" value={o} checked={demographics.program === o} onChange={e => setDemographics({...demographics, program: e.target.value})} className="mr-2" />{o}
                </label>
              ))}</div>
            </div>
            <div><label className="block text-sm font-medium mb-1">Major/Field of Study *</label>
              <div className="space-y-2">{['Construction Science', 'Construction Management', 'Civil Engineering', 'Other'].map(o => (
                <label key={o} className={`block p-3 rounded-lg border-2 cursor-pointer ${demographics.major === o ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                  <input type="radio" name="major" value={o} checked={demographics.major === o} onChange={e => setDemographics({...demographics, major: e.target.value})} className="mr-2" />{o}
                </label>
              ))}</div>
            </div>
            <div><label className="block text-sm font-medium mb-1">Prior scheduling courses? *</label>
              <div className="flex gap-4">{['Yes', 'No'].map(o => (
                <label key={o} className={`flex-1 p-3 rounded-lg border-2 cursor-pointer text-center ${demographics.priorCourses === o ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                  <input type="radio" name="prior" value={o} checked={demographics.priorCourses === o} onChange={e => setDemographics({...demographics, priorCourses: e.target.value})} className="mr-2" />{o}
                </label>
              ))}</div>
            </div>
            <div><label className="block text-sm font-medium mb-1">LOB Familiarity *</label>
              <div className="space-y-2">{[{v:'never',l:'Never heard of it'},{v:'heard',l:'Heard but never used'},{v:'class',l:'Used in class'},{v:'real',l:'Used in real projects'}].map(o => (
                <label key={o.v} className={`block p-3 rounded-lg border-2 cursor-pointer ${demographics.lobFamiliarity === o.v ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                  <input type="radio" name="lob" value={o.v} checked={demographics.lobFamiliarity === o.v} onChange={e => setDemographics({...demographics, lobFamiliarity: e.target.value})} className="mr-2" />{o.l}
                </label>
              ))}</div>
            </div>
            <button onClick={() => setStep(2)} disabled={!isDemoComplete} className={`w-full py-3 rounded-lg font-bold ${isDemoComplete ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400'}`}>Continue →</button>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-blue-900 border-b pb-2">Section 2: Knowledge</h2>
            <p className="text-sm text-gray-600">Select the best answer. It's okay to guess!</p>
            {KNOWLEDGE_QUESTIONS.map(q => (
              <div key={q.id} className="border rounded-lg p-4">
                <h3 className="font-bold mb-3">{q.id}. {q.question}</h3>
                <div className="space-y-2">{q.options.map(o => (
                  <label key={o.value} className={`block p-3 rounded-lg border-2 cursor-pointer ${knowledge[q.id] === o.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                    <input type="radio" name={q.id} value={o.value} checked={knowledge[q.id] === o.value} onChange={e => setKnowledge({...knowledge, [q.id]: e.target.value})} className="mr-2" />
                    <span className="font-medium">{o.value.toUpperCase()})</span> {o.label}
                  </label>
                ))}</div>
              </div>
            ))}
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-lg font-bold border-2">← Back</button>
              <button onClick={() => setStep(3)} disabled={!isKnowComplete} className={`flex-1 py-3 rounded-lg font-bold ${isKnowComplete ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}>Continue →</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="bg-white rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-blue-900 border-b pb-2">Section 3: Confidence</h2>
            <p className="text-sm text-gray-600">1 = Not confident, 5 = Very confident</p>
            {SELF_EFFICACY_QUESTIONS.map(q => (
              <div key={q.id} className="border rounded-lg p-4">
                <h3 className="font-medium mb-3">{q.id}. {q.question}</h3>
                <div className="flex justify-between">
                  {[1,2,3,4,5].map(n => (
                    <label key={n} className={`flex flex-col items-center cursor-pointer p-2 rounded-lg ${selfEfficacy[q.id] === n ? 'bg-blue-100 ring-2 ring-blue-500' : 'hover:bg-gray-100'}`}>
                      <input type="radio" className="sr-only" checked={selfEfficacy[q.id] === n} onChange={() => setSelfEfficacy({...selfEfficacy, [q.id]: n})} />
                      <span className={`text-2xl font-bold ${selfEfficacy[q.id] === n ? 'text-blue-600' : 'text-gray-400'}`}>{n}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-lg font-bold border-2">← Back</button>
              <button onClick={handleSubmit} disabled={!isSEComplete || submitting} className={`flex-1 py-3 rounded-lg font-bold ${isSEComplete && !submitting ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-400'}`}>{submitting ? '⏳...' : '🎮 Start Game →'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== POST-SURVEY ====================
function PostSurvey({ onComplete, sessionId, playerName, studentId }) {
  const [step, setStep] = useState(1);
  const [knowledge, setKnowledge] = useState({});
  const [selfEfficacy, setSelfEfficacy] = useState({});
  const [experience, setExperience] = useState({});
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isKnowComplete = KNOWLEDGE_QUESTIONS.every(q => knowledge[q.id]);
  const isSEComplete = SELF_EFFICACY_QUESTIONS.every(q => selfEfficacy[q.id]);
  const isEXComplete = EXPERIENCE_QUESTIONS.every(q => experience[q.id]);

  const handleSubmit = async () => {
    setSubmitting(true);
    const data = { sessionId, timestamp: new Date().toISOString(), studentId, knowledge, knowledgeScore: calculateKnowledgeScore(knowledge), selfEfficacy, seScore: calculateMeanScore(selfEfficacy, SELF_EFFICACY_QUESTIONS), experience, exScore: calculateMeanScore(experience, EXPERIENCE_QUESTIONS), comments };
    await submitToGoogleSheets('post-survey', data);
    onComplete({ knowledge, knowledgeScore: data.knowledgeScore, selfEfficacy, seScore: data.seScore, experience, exScore: data.exScore, comments });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-600 p-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center text-white mb-6"><h1 className="text-3xl font-bold">📝 Post-Game Survey</h1><p className="text-green-200">Almost done, {playerName}!</p></div>
        
        <div className="bg-white rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between text-sm">
            {[{n:1,t:'Knowledge'},{n:2,t:'Confidence'},{n:3,t:'Experience'}].map((s,i) => (
              <React.Fragment key={s.n}>
                <div className={`flex items-center gap-2 ${step >= s.n ? 'text-green-600 font-bold' : 'text-gray-400'}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= s.n ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>{s.n}</span>{s.t}
                </div>
                {i < 2 && <div className="flex-1 h-1 mx-2 bg-gray-200"><div className={`h-full bg-green-600 transition-all ${step > s.n ? 'w-full' : 'w-0'}`} /></div>}
              </React.Fragment>
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="bg-white rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-green-900 border-b pb-2">Section 1: Knowledge</h2>
            <p className="text-sm text-gray-600">Same questions as before - let's see what you learned!</p>
            {KNOWLEDGE_QUESTIONS.map(q => (
              <div key={q.id} className="border rounded-lg p-4">
                <h3 className="font-bold mb-3">{q.id}. {q.question}</h3>
                <div className="space-y-2">{q.options.map(o => (
                  <label key={o.value} className={`block p-3 rounded-lg border-2 cursor-pointer ${knowledge[q.id] === o.value ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                    <input type="radio" name={`post-${q.id}`} value={o.value} checked={knowledge[q.id] === o.value} onChange={e => setKnowledge({...knowledge, [q.id]: e.target.value})} className="mr-2" />
                    <span className="font-medium">{o.value.toUpperCase()})</span> {o.label}
                  </label>
                ))}</div>
              </div>
            ))}
            <button onClick={() => setStep(2)} disabled={!isKnowComplete} className={`w-full py-3 rounded-lg font-bold ${isKnowComplete ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-400'}`}>Continue →</button>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-green-900 border-b pb-2">Section 2: Confidence</h2>
            <p className="text-sm text-gray-600">How confident are you NOW?</p>
            {SELF_EFFICACY_QUESTIONS.map(q => (
              <div key={q.id} className="border rounded-lg p-4">
                <h3 className="font-medium mb-3">{q.id}. {q.question}</h3>
                <div className="flex justify-between">
                  {[1,2,3,4,5].map(n => (
                    <label key={n} className={`flex flex-col items-center cursor-pointer p-2 rounded-lg ${selfEfficacy[q.id] === n ? 'bg-green-100 ring-2 ring-green-500' : 'hover:bg-gray-100'}`}>
                      <input type="radio" className="sr-only" checked={selfEfficacy[q.id] === n} onChange={() => setSelfEfficacy({...selfEfficacy, [q.id]: n})} />
                      <span className={`text-2xl font-bold ${selfEfficacy[q.id] === n ? 'text-green-600' : 'text-gray-400'}`}>{n}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-lg font-bold border-2">← Back</button>
              <button onClick={() => setStep(3)} disabled={!isSEComplete} className={`flex-1 py-3 rounded-lg font-bold ${isSEComplete ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-400'}`}>Continue →</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="bg-white rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-green-900 border-b pb-2">Section 3: Experience</h2>
            <p className="text-sm text-gray-600">1 = Strongly Disagree, 5 = Strongly Agree</p>
            {EXPERIENCE_QUESTIONS.map(q => (
              <div key={q.id} className="border rounded-lg p-4">
                <h3 className="font-medium mb-3">{q.id}. {q.question}</h3>
                <div className="flex justify-between">
                  {[1,2,3,4,5].map(n => (
                    <label key={n} className={`flex flex-col items-center cursor-pointer p-2 rounded-lg ${experience[q.id] === n ? 'bg-green-100 ring-2 ring-green-500' : 'hover:bg-gray-100'}`}>
                      <input type="radio" className="sr-only" checked={experience[q.id] === n} onChange={() => setExperience({...experience, [q.id]: n})} />
                      <span className={`text-2xl font-bold ${experience[q.id] === n ? 'text-green-600' : 'text-gray-400'}`}>{n}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div><label className="block text-sm font-medium mb-1">Comments (optional)</label><textarea value={comments} onChange={e => setComments(e.target.value)} className="w-full px-3 py-2 border-2 rounded-lg" rows={3} placeholder="Any feedback..." /></div>
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-lg font-bold border-2">← Back</button>
              <button onClick={handleSubmit} disabled={!isEXComplete || submitting} className={`flex-1 py-3 rounded-lg font-bold ${isEXComplete && !submitting ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-400'}`}>{submitting ? '⏳...' : '✅ Submit'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== THANK YOU ====================
function ThankYou({ playerName, preSurvey, postSurvey, gameResults }) {
  const kGain = postSurvey.knowledgeScore - preSurvey.knowledgeScore;
  const seGain = (parseFloat(postSurvey.seScore) - parseFloat(preSurvey.seScore)).toFixed(2);
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-purple-700 p-4 flex items-center justify-center">
      <div className="max-w-2xl w-full bg-white rounded-xl p-8 text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-3xl font-bold text-purple-900 mb-2">Thank You, {playerName}!</h1>
        <p className="text-gray-600 mb-6">You have completed the LOB Simulation Game.</p>
        <div className="bg-purple-50 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">📊 Your Results</h2>
          <div className="grid grid-cols-2 gap-4 text-left">
            <div className="bg-white rounded-lg p-4"><div className="text-sm text-gray-500">Knowledge</div><div className="flex items-baseline gap-2"><span className="text-gray-400">{preSurvey.knowledgeScore}/8</span><span>→</span><span className="text-2xl font-bold text-purple-600">{postSurvey.knowledgeScore}/8</span></div><div className={`text-sm font-bold ${kGain > 0 ? 'text-green-600' : 'text-gray-500'}`}>{kGain > 0 ? `+${kGain}` : 'No change'}</div></div>
            <div className="bg-white rounded-lg p-4"><div className="text-sm text-gray-500">Confidence</div><div className="flex items-baseline gap-2"><span className="text-gray-400">{preSurvey.seScore}</span><span>→</span><span className="text-2xl font-bold text-purple-600">{postSurvey.seScore}</span></div><div className={`text-sm font-bold ${parseFloat(seGain) > 0 ? 'text-green-600' : 'text-gray-500'}`}>{parseFloat(seGain) > 0 ? `+${seGain}` : 'No change'}</div></div>
            <div className="bg-white rounded-lg p-4"><div className="text-sm text-gray-500">Final Duration</div><div className="text-2xl font-bold text-purple-600">{gameResults[6]?.end || '-'} days</div><div className={`text-sm ${(gameResults[6]?.end || 999) <= TARGET_DAYS ? 'text-green-600' : 'text-red-600'}`}>Target: ≤{TARGET_DAYS} {(gameResults[6]?.end || 999) <= TARGET_DAYS ? '✅' : '❌'}</div></div>
            <div className="bg-white rounded-lg p-4"><div className="text-sm text-gray-500">Final Cost</div><div className="text-2xl font-bold text-purple-600">${((gameResults[6]?.cost || 0) / 1000).toFixed(0)}K</div><div className={`text-sm ${(gameResults[6]?.cost || 999999) <= TARGET_COST ? 'text-green-600' : 'text-red-600'}`}>Target: ≤${TARGET_COST / 1000}K {(gameResults[6]?.cost || 999999) <= TARGET_COST ? '✅' : '❌'}</div></div>
          </div>
        </div>
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-6"><strong>✅ Responses recorded!</strong><p className="text-sm">Thank you for participating!</p></div>
        <button onClick={() => window.location.reload()} className="px-8 py-3 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700">🔄 Play Again</button>
      </div>
    </div>
  );
}

// ==================== QUIZ STEP ====================
function QuizStep({ dur, onComplete }) {
  const [answers, setAnswers] = useState({ q1: null, q2: null, q3: '' });
  const [submitted, setSubmitted] = useState({ q1: false, q2: false, q3: false });
  const correct = { q1: 'c', q2: 'b', q3: dur.back };
  const isCorrect = { q1: answers.q1 === correct.q1, q2: answers.q2 === correct.q2, q3: parseInt(answers.q3) === correct.q3 };
  const allSubmitted = submitted.q1 && submitted.q2 && submitted.q3;

  const getClass = (qid, val) => {
    const sel = answers[qid] === val, sub = submitted[qid], cor = val === correct[qid];
    if (!sub) return `block w-full p-3 rounded border-2 cursor-pointer text-left ${sel ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`;
    if (cor) return 'block w-full p-3 rounded border-2 border-green-500 bg-green-50 text-left';
    if (sel && !cor) return 'block w-full p-3 rounded border-2 border-red-500 bg-red-50 text-left';
    return 'block w-full p-3 rounded border-2 border-gray-200 bg-gray-50 text-left opacity-50';
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded"><h3 className="font-bold text-lg">📚 Step 1: Knowledge Check</h3><p className="text-sm text-gray-600">Before creating your schedule, answer these questions.</p></div>
      
      <div className="bg-white rounded-lg shadow p-5">
        <h4 className="font-bold mb-3">Q1. What is the correct sequence?</h4>
        <div className="space-y-2 mb-4">
          {[{v:'a',l:'Backfill → Pipe → Excavation'},{v:'b',l:'Pipe → Excavation → Backfill'},{v:'c',l:'Excavation → Pipe → Backfill'}].map(o => (
            <button key={o.v} onClick={() => !submitted.q1 && setAnswers({...answers, q1: o.v})} className={getClass('q1', o.v)} disabled={submitted.q1}>{o.v.toUpperCase()}) {o.l}</button>
          ))}
        </div>
        {!submitted.q1 ? <button onClick={() => setSubmitted({...submitted, q1: true})} disabled={!answers.q1} className={`px-4 py-2 rounded font-bold ${answers.q1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}>Check</button>
          : <div className={`p-3 rounded ${isCorrect.q1 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{isCorrect.q1 ? '✅ Correct!' : '❌ Incorrect. Excavation must come first.'}</div>}
      </div>

      <div className="bg-white rounded-lg shadow p-5">
        <h4 className="font-bold mb-3">Q2. Which crew is SLOWEST?</h4>
        <div className="bg-gray-50 rounded p-3 mb-4 text-sm">
          <table className="w-full"><tbody>
            <tr><td>⛏️ Excavation</td><td className="text-right">{CREWS.exc.rate} ft/day</td></tr>
            <tr><td>🔧 Pipe Laying</td><td className="text-right">{CREWS.pipe.rate} ft/day</td></tr>
            <tr><td>🚜 Backfill</td><td className="text-right">{CREWS.back.rate} ft/day</td></tr>
          </tbody></table>
        </div>
        <div className="space-y-2 mb-4">
          {[{v:'a',l:`Excavation (${CREWS.exc.rate})`},{v:'b',l:`Pipe Laying (${CREWS.pipe.rate})`},{v:'c',l:`Backfill (${CREWS.back.rate})`}].map(o => (
            <button key={o.v} onClick={() => !submitted.q2 && setAnswers({...answers, q2: o.v})} className={getClass('q2', o.v)} disabled={submitted.q2}>{o.v.toUpperCase()}) {o.l}</button>
          ))}
        </div>
        {!submitted.q2 ? <button onClick={() => setSubmitted({...submitted, q2: true})} disabled={!answers.q2} className={`px-4 py-2 rounded font-bold ${answers.q2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}>Check</button>
          : <div className={`p-3 rounded ${isCorrect.q2 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{isCorrect.q2 ? '✅ Correct! Pipe Laying is slowest.' : '❌ Incorrect. Slowest = lowest rate.'}</div>}
      </div>

      <div className="bg-white rounded-lg shadow p-5">
        <h4 className="font-bold mb-3">Q3. Backfill duration? (Length={PROJECT_LENGTH.toLocaleString()}, Rate={CREWS.back.rate})</h4>
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4 text-sm"><strong>Formula:</strong> Duration = ROUNDUP(Length ÷ Rate)</div>
        <div className="flex items-center gap-3 mb-4">
          <span>Duration =</span>
          <input type="number" value={answers.q3} onChange={e => setAnswers({...answers, q3: e.target.value})} disabled={submitted.q3} className={`w-24 px-3 py-2 border-2 rounded text-center font-bold ${submitted.q3 ? (isCorrect.q3 ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50') : 'border-gray-300'}`} />
          <span>days</span>
        </div>
        {!submitted.q3 ? <button onClick={() => setSubmitted({...submitted, q3: true})} disabled={!answers.q3} className={`px-4 py-2 rounded font-bold ${answers.q3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}>Check</button>
          : <div className={`p-3 rounded ${isCorrect.q3 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{isCorrect.q3 ? `✅ Correct! ${dur.back} days` : `❌ It's ${dur.back} days (rounded up)`}</div>}
      </div>

      {allSubmitted && <div className="border-2 rounded-lg p-5 text-center bg-green-50 border-green-500">
        <h3 className="font-bold text-xl mb-2">Quiz Complete!</h3>
        <button onClick={onComplete} className="px-6 py-3 bg-green-600 text-white rounded-lg font-bold text-lg hover:bg-green-700">Continue to Scheduler →</button>
      </div>}
    </div>
  );
}

// ==================== DRAGGABLE BAR CHART ====================
function DraggableBarChart({ schedule, onScheduleChange, conflictStatus }) {
  const chartRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);
  const WIDTH = 700, PAD = 100, MAX = 150, PPD = (WIDTH - PAD) / MAX, BH = 32, BG = 8;
  const toP = d => PAD + d * PPD;
  const toD = p => Math.max(MOB_DAYS + 1, Math.min(Math.round((p - PAD) / PPD), 140));

  const onDown = (t, e) => {
    e.preventDefault();
    const r = chartRef.current.getBoundingClientRect();
    setDragOffset(e.clientX - r.left - toP(t === 'pipe' ? schedule.pipeStart : schedule.backStart));
    setDragging(t);
  };

  const onMove = useCallback(e => {
    if (!dragging || !chartRef.current) return;
    const r = chartRef.current.getBoundingClientRect();
    onScheduleChange({ ...schedule, [dragging === 'pipe' ? 'pipeStart' : 'backStart']: toD(e.clientX - r.left - dragOffset) });
  }, [dragging, dragOffset, schedule, onScheduleChange]);

  const onUp = useCallback(() => setDragging(null), []);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging, onMove, onUp]);

  const bars = [
    { id: 'mob', label: 'Mobilization', start: 1, end: MOB_DAYS, color: 'bg-gray-400', locked: true },
    { id: 'exc', label: 'Excavation', start: MOB_DAYS + 1, end: MOB_DAYS + DURATIONS.exc, color: 'bg-blue-500', locked: true },
    { id: 'pipe', label: 'Pipe Laying', start: schedule.pipeStart, end: schedule.pipeStart + DURATIONS.pipe - 1, color: 'bg-green-500', locked: false },
    { id: 'back', label: 'Backfill', start: schedule.backStart, end: schedule.backStart + DURATIONS.back - 1, color: 'bg-orange-500', locked: false }
  ];

  return (
    <div ref={chartRef} className="relative bg-gray-50 rounded-lg p-4 overflow-x-auto" style={{ width: '100%', minWidth: WIDTH, height: bars.length * (BH + BG) + 80 }}>
      {[0, 20, 40, 60, 80, 100, 120, 140].map(d => <div key={d} className="absolute top-0 bottom-8 w-px bg-gray-200" style={{ left: toP(d) }} />)}
      <div className="absolute bottom-2 left-0 right-0 flex text-xs text-gray-500">
        {[0, 20, 40, 60, 80, 100, 120, 140].map(d => <span key={d} className="absolute" style={{ left: toP(d) - 10 }}>{d}</span>)}
      </div>
      {bars.map((b, i) => <div key={`l-${b.id}`} className="absolute left-2 text-xs font-medium text-gray-600 w-24" style={{ top: i * (BH + BG) + 15 + BH / 2 - 8 }}>{b.label}</div>)}
      {bars.map((b, i) => (
        <div key={b.id} className={`absolute ${b.color} rounded flex items-center justify-center text-white text-xs font-bold ${b.locked ? 'cursor-not-allowed opacity-90' : 'cursor-grab shadow-lg hover:shadow-xl'} ${dragging === b.id ? 'ring-4 ring-yellow-300 z-10' : ''} ${!b.locked && conflictStatus.hasConflict ? 'animate-pulse' : ''}`}
          style={{ left: toP(b.start), width: Math.max((b.end - b.start + 1) * PPD, 30), height: BH, top: i * (BH + BG) + 15 }}
          onMouseDown={b.locked ? undefined : e => onDown(b.id, e)}>
          {b.locked && <span className="mr-1">🔒</span>}{b.start}-{b.end}
        </div>
      ))}
    </div>
  );
}

// ==================== PIPELINE VIEWER ====================
function PipelineViewer({ schedule, viewDay, onViewDayChange }) {
  const projectEnd = Math.max(MOB_DAYS + DURATIONS.exc, schedule.pipeStart + DURATIONS.pipe - 1, schedule.backStart + DURATIONS.back - 1);
  const positions = {
    exc: getPositionAtDay(MOB_DAYS + 1, CREWS.exc.rate, viewDay),
    pipe: getPositionAtDay(schedule.pipeStart, CREWS.pipe.rate, viewDay),
    back: getPositionAtDay(schedule.backStart, CREWS.back.rate, viewDay)
  };
  const conflicts = [];
  if (positions.pipe > positions.exc && positions.exc < PROJECT_LENGTH) conflicts.push({ type: 'pipe-exc', diff: positions.pipe - positions.exc });
  if (positions.back > positions.pipe && positions.pipe < PROJECT_LENGTH) conflicts.push({ type: 'back-pipe', diff: positions.back - positions.pipe });

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h4 className="font-bold mb-3">📍 Pipeline Position at Day {viewDay}</h4>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-gray-500">Day:</span>
        <input type="range" min={MOB_DAYS + 1} max={projectEnd} value={viewDay} onChange={e => onViewDayChange(parseInt(e.target.value))} className="flex-1" />
        <input type="number" min={MOB_DAYS + 1} max={projectEnd} value={viewDay} onChange={e => onViewDayChange(Math.max(MOB_DAYS + 1, Math.min(parseInt(e.target.value) || MOB_DAYS + 1, projectEnd)))} className="w-16 px-2 py-1 border rounded text-center" />
      </div>
      <div className="relative bg-gray-100 rounded-lg p-4 mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-2"><span>0 ft</span><span>4,000</span><span>8,000</span><span>12,000</span><span>{PROJECT_LENGTH.toLocaleString()} ft</span></div>
        <div className="h-2 bg-gray-300 rounded-full mb-4" />
        {[{ id: 'exc', name: 'Excavation', icon: '⛏️', color: 'bg-blue-500', pos: positions.exc },
          { id: 'pipe', name: 'Pipe Laying', icon: '🔧', color: 'bg-green-500', pos: positions.pipe },
          { id: 'back', name: 'Backfill', icon: '🚜', color: 'bg-orange-500', pos: positions.back }
        ].map(c => (
          <div key={c.id} className="relative h-10 mb-2">
            <div className={`absolute h-3 ${c.color} rounded-full top-3`} style={{ width: `${(c.pos / PROJECT_LENGTH) * 100}%` }} />
            <div className="absolute top-0 transform -translate-x-1/2 text-xl" style={{ left: `${(c.pos / PROJECT_LENGTH) * 100}%` }}>{c.icon}</div>
            <span className="absolute right-0 top-2 text-xs text-gray-600">{c.name}: {c.pos.toLocaleString()} ft</span>
          </div>
        ))}
      </div>
      {conflicts.length > 0 ? (
        <div className="bg-red-50 border border-red-200 rounded p-3">
          <div className="font-bold text-red-700 mb-2">❌ Conflict at Day {viewDay}!</div>
          {conflicts.map((c, i) => <div key={i} className="text-sm text-red-600">{c.type === 'back-pipe' ? `🚜 Backfill ahead of 🔧 Pipe by ${c.diff.toLocaleString()} ft` : `🔧 Pipe ahead of ⛏️ Excavation by ${c.diff.toLocaleString()} ft`}</div>)}
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded p-3"><div className="font-bold text-green-700">✅ No conflict</div></div>
      )}
    </div>
  );
}

// ==================== SCHEDULER STEP ====================
function SchedulerStep({ onComplete }) {
  const [schedule, setSchedule] = useState({ pipeStart: MOB_DAYS + 1, backStart: MOB_DAYS + 1 });
  const [viewDay, setViewDay] = useState(MOB_DAYS + 30);

  const fullSchedule = {
    excS: MOB_DAYS + 1, excE: MOB_DAYS + DURATIONS.exc,
    pipeS: schedule.pipeStart, pipeE: schedule.pipeStart + DURATIONS.pipe - 1,
    backS: schedule.backStart, backE: schedule.backStart + DURATIONS.back - 1,
    end: Math.max(MOB_DAYS + DURATIONS.exc, schedule.pipeStart + DURATIONS.pipe - 1, schedule.backStart + DURATIONS.back - 1)
  };

  const checkConflicts = useCallback(() => {
    for (let d = MOB_DAYS + 1; d <= fullSchedule.end; d++) {
      const exc = getPositionAtDay(MOB_DAYS + 1, CREWS.exc.rate, d);
      const pipe = getPositionAtDay(schedule.pipeStart, CREWS.pipe.rate, d);
      const back = getPositionAtDay(schedule.backStart, CREWS.back.rate, d);
      if (pipe > exc && exc < PROJECT_LENGTH) return { hasConflict: true, firstConflictDay: d, type: 'pipe-exc' };
      if (back > pipe && pipe < PROJECT_LENGTH) return { hasConflict: true, firstConflictDay: d, type: 'back-pipe' };
    }
    return { hasConflict: false, firstConflictDay: null, type: null };
  }, [schedule, fullSchedule.end]);

  const conflictStatus = checkConflicts();

  return (
    <div className="space-y-4">
      <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded"><h3 className="font-bold text-lg">🎮 Step 2: Interactive Scheduler</h3><p className="text-sm text-gray-600">Drag the <span className="text-green-600 font-bold">green</span> and <span className="text-orange-600 font-bold">orange</span> bars to avoid conflicts.</p></div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-bold">📊 Drag Bars to Adjust</h4>
          <button onClick={() => { setSchedule({ pipeStart: MOB_DAYS + 1, backStart: MOB_DAYS + 1 }); setViewDay(MOB_DAYS + 30); }} className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300">🔄 Reset</button>
        </div>
        <DraggableBarChart schedule={schedule} onScheduleChange={setSchedule} conflictStatus={conflictStatus} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h4 className="font-bold mb-3">📋 Schedule</h4>
          <table className="w-full text-sm border-collapse">
            <thead><tr className="bg-gray-100"><th className="px-3 py-2 border text-left">Activity</th><th className="px-3 py-2 border text-center">Start</th><th className="px-3 py-2 border text-center">End</th></tr></thead>
            <tbody>
              <tr className="bg-gray-50"><td className="px-3 py-2 border">📦 Mobilization</td><td className="px-3 py-2 border text-center">1</td><td className="px-3 py-2 border text-center">{MOB_DAYS}</td></tr>
              <tr className="bg-blue-50"><td className="px-3 py-2 border">⛏️ Excavation</td><td className="px-3 py-2 border text-center font-bold">{fullSchedule.excS} 🔒</td><td className="px-3 py-2 border text-center font-bold">{fullSchedule.excE}</td></tr>
              <tr className="bg-green-50"><td className="px-3 py-2 border">🔧 Pipe Laying</td><td className="px-3 py-2 border text-center font-bold">{fullSchedule.pipeS}</td><td className="px-3 py-2 border text-center font-bold">{fullSchedule.pipeE}</td></tr>
              <tr className="bg-orange-50"><td className="px-3 py-2 border">🚜 Backfill</td><td className="px-3 py-2 border text-center font-bold">{fullSchedule.backS}</td><td className="px-3 py-2 border text-center font-bold">{fullSchedule.backE}</td></tr>
            </tbody>
          </table>
          <div className="mt-4 p-3 bg-blue-50 rounded text-center"><span className="text-gray-600">Project End:</span><span className="ml-2 text-2xl font-bold text-blue-600">{fullSchedule.end} days</span></div>
          {conflictStatus.hasConflict && <div className="mt-3 bg-red-50 border border-red-200 rounded p-3"><div className="font-bold text-red-700">Conflict at Day {conflictStatus.firstConflictDay}</div><button onClick={() => setViewDay(conflictStatus.firstConflictDay)} className="mt-2 px-3 py-2 bg-red-600 text-white rounded font-bold hover:bg-red-700">View Conflict</button></div>}
        </div>
        <PipelineViewer schedule={schedule} viewDay={viewDay} onViewDayChange={setViewDay} />
      </div>
      <div className="text-center">
        {!conflictStatus.hasConflict ? (
          <button onClick={() => onComplete(fullSchedule)} className="px-8 py-4 bg-green-600 text-white rounded-lg font-bold text-lg hover:bg-green-700 shadow-lg">✅ Complete R1 → Proceed to R2</button>
        ) : (
          <button disabled className="px-8 py-4 bg-gray-300 text-gray-500 rounded-lg font-bold text-lg cursor-not-allowed">🚫 Fix Conflicts to Proceed</button>
        )}
      </div>
    </div>
  );
}

// ==================== MAIN GAME ====================
export default function LOBGame() {
  const [sessionId] = useState(() => `session_${Date.now()}`);
  const [round, setRound] = useState(0);
  const [preSurveyData, setPreSurveyData] = useState(null);
  const [postSurveyData, setPostSurveyData] = useState(null);
  const [r1Step, setR1Step] = useState(1);
  const [r1Input, setR1Input] = useState({ pipeS: '', backS: '' });
  const [r2Input, setR2Input] = useState({ excS: '', excE: '', pipeS: '', pipeE: '', backS: '', backE: '' });
  const [r2Validated, setR2Validated] = useState(false);
  const [r3Buffer, setR3Buffer] = useState(5);
  const [r4Eq, setR4Eq] = useState({ exc: 1, pipe: 0, back: 1 });
  const [r5Config, setR5Config] = useState({ exc: { small: 0, standard: 1, large: 0 }, pipe: { standard: 1, heavy: 0 }, back: { small: 0, standard: 1, large: 0 } });
  const [r5Buffer, setR5Buffer] = useState(5);
  const [results, setResults] = useState({});

  const dur = useMemo(() => ({ exc: Math.ceil(PROJECT_LENGTH / CREWS.exc.rate), pipe: Math.ceil(PROJECT_LENGTH / CREWS.pipe.rate), back: Math.ceil(PROJECT_LENGTH / CREWS.back.rate) }), []);

  const r1Student = useMemo(() => {
    const excS = MOB_DAYS + 1, excE = excS + dur.exc - 1;
    const pipeS = parseInt(r1Input.pipeS) || 0, pipeE = pipeS > 0 ? pipeS + dur.pipe - 1 : 0;
    const backS = parseInt(r1Input.backS) || 0, backE = backS > 0 ? backS + dur.back - 1 : 0;
    return { excS, excE, pipeS, pipeE, backS, backE, end: Math.max(excE, pipeE, backE) };
  }, [r1Input, dur]);

  const r2Correct = useMemo(() => {
    const excS = MOB_DAYS + 1, excE = excS + dur.exc - 1;
    const pipeS = excS + DEFAULT_BUFFER, pipeE = pipeS + dur.pipe - 1;
    const backS = pipeE + DEFAULT_BUFFER - dur.back + 1, backE = backS + dur.back - 1;
    return { excS, excE, pipeS, pipeE, backS, backE, end: Math.max(excE, pipeE, backE) };
  }, [dur]);

  const r2Student = useMemo(() => ({
    excS: parseInt(r2Input.excS) || 0, excE: parseInt(r2Input.excE) || 0,
    pipeS: parseInt(r2Input.pipeS) || 0, pipeE: parseInt(r2Input.pipeE) || 0,
    backS: parseInt(r2Input.backS) || 0, backE: parseInt(r2Input.backE) || 0,
    end: Math.max(parseInt(r2Input.excE) || 0, parseInt(r2Input.pipeE) || 0, parseInt(r2Input.backE) || 0)
  }), [r2Input]);

  const r2IsCorrect = r2Student.excS === r2Correct.excS && r2Student.excE === r2Correct.excE && r2Student.pipeS === r2Correct.pipeS && r2Student.pipeE === r2Correct.pipeE && r2Student.backS === r2Correct.backS && r2Student.backE === r2Correct.backE;

  const r2Cost = useMemo(() => {
    const excC = dur.exc * CREWS.exc.cost, pipeC = dur.pipe * CREWS.pipe.cost, backC = dur.back * CREWS.back.cost;
    const direct = MOB_COST + excC + pipeC + backC, indirect = Math.round(direct * INDIRECT_RATE), profit = Math.round((direct + indirect) * PROFIT_RATE);
    return { direct, indirect, profit, total: direct + indirect + profit, excC, pipeC, backC };
  }, [dur]);

  const r3 = useMemo(() => {
    const excS = MOB_DAYS + 1, excE = excS + dur.exc - 1;
    const pipeS = excS + r3Buffer, pipeE = pipeS + dur.pipe - 1;
    const backS = pipeE + r3Buffer - dur.back + 1, backE = backS + dur.back - 1;
    return { excS, excE, pipeS, pipeE, backS, backE, end: Math.max(excE, pipeE, backE) };
  }, [dur, r3Buffer]);

  const r4 = useMemo(() => {
    const exc = EQUIPMENT.exc[r4Eq.exc], pipe = EQUIPMENT.pipe[r4Eq.pipe], back = EQUIPMENT.back[r4Eq.back];
    const excDur = Math.ceil(PROJECT_LENGTH / exc.rate), pipeDur = Math.ceil(PROJECT_LENGTH / pipe.rate), backDur = Math.ceil(PROJECT_LENGTH / back.rate);
    const excS = MOB_DAYS + 1, excE = excS + excDur - 1;
    const pipeS = pipe.rate < exc.rate ? excS + DEFAULT_BUFFER : excE + DEFAULT_BUFFER - pipeDur + 1, pipeE = pipeS + pipeDur - 1;
    const backS = back.rate < pipe.rate ? pipeS + DEFAULT_BUFFER : pipeE + DEFAULT_BUFFER - backDur + 1, backE = backS + backDur - 1;
    return { excS, excE, excDur, excRate: exc.rate, excCost: exc.cost, excName: exc.name, pipeS, pipeE, pipeDur, pipeRate: pipe.rate, pipeCost: pipe.cost, pipeName: pipe.name, backS, backE, backDur, backRate: back.rate, backCost: back.cost, backName: back.name, end: Math.max(excE, pipeE, backE) };
  }, [r4Eq]);

  const r4Cost = useMemo(() => {
    const excC = r4.excDur * r4.excCost, pipeC = r4.pipeDur * r4.pipeCost, backC = r4.backDur * r4.backCost;
    const direct = MOB_COST + excC + pipeC + backC, indirect = Math.round(direct * INDIRECT_RATE), profit = Math.round((direct + indirect) * PROFIT_RATE);
    return { direct, indirect, profit, total: direct + indirect + profit, excC, pipeC, backC };
  }, [r4]);

  const r5Calc = useMemo(() => {
    const excRate = (r5Config.exc.small * 165) + (r5Config.exc.standard * 220) + (r5Config.exc.large * 330) || 1;
    const excCost = (r5Config.exc.small * 900) + (r5Config.exc.standard * 1200) + (r5Config.exc.large * 1800);
    const pipeRate = (r5Config.pipe.standard * 180) + (r5Config.pipe.heavy * 270) || 1;
    const pipeCost = (r5Config.pipe.standard * 1800) + (r5Config.pipe.heavy * 2800);
    const backRate = (r5Config.back.small * 180) + (r5Config.back.standard * 250) + (r5Config.back.large * 375) || 1;
    const backCost = (r5Config.back.small * 1400) + (r5Config.back.standard * 1800) + (r5Config.back.large * 2600);
    return { exc: { rate: excRate, cost: excCost }, pipe: { rate: pipeRate, cost: pipeCost }, back: { rate: backRate, cost: backCost } };
  }, [r5Config]);

  const r5 = useMemo(() => {
    const excDur = Math.ceil(PROJECT_LENGTH / r5Calc.exc.rate), pipeDur = Math.ceil(PROJECT_LENGTH / r5Calc.pipe.rate), backDur = Math.ceil(PROJECT_LENGTH / r5Calc.back.rate);
    const excS = MOB_DAYS + 1, excE = excS + excDur - 1;
    const pipeS = r5Calc.pipe.rate < r5Calc.exc.rate ? excS + r5Buffer : excE + r5Buffer - pipeDur + 1, pipeE = pipeS + pipeDur - 1;
    const backS = r5Calc.back.rate < r5Calc.pipe.rate ? pipeS + r5Buffer : pipeE + r5Buffer - backDur + 1, backE = backS + backDur - 1;
    return { excS, excE, excDur, excRate: r5Calc.exc.rate, excCost: r5Calc.exc.cost, pipeS, pipeE, pipeDur, pipeRate: r5Calc.pipe.rate, pipeCost: r5Calc.pipe.cost, backS, backE, backDur, backRate: r5Calc.back.rate, backCost: r5Calc.back.cost, end: Math.max(excE, pipeE, backE) };
  }, [r5Calc, r5Buffer]);

  const r5Cost = useMemo(() => {
    const excC = r5.excDur * r5.excCost, pipeC = r5.pipeDur * r5.pipeCost, backC = r5.backDur * r5.backCost;
    const direct = MOB_COST + excC + pipeC + backC, indirect = Math.round(direct * INDIRECT_RATE), profit = Math.round((direct + indirect) * PROFIT_RATE);
    return { direct, indirect, profit, total: direct + indirect + profit, excC, pipeC, backC };
  }, [r5]);

  const genLOB = (schedules) => {
    const data = [], maxDay = Math.max(...schedules.map(s => s.end || 0), 100) + 10;
    for (let d = 0; d <= maxDay; d += 2) {
      const pt = { day: d };
      schedules.forEach((s, i) => {
        ['exc', 'pipe', 'back'].forEach(t => {
          const start = s[t + 'S'], end = s[t + 'E'];
          if (start > 0 && end > 0) pt[t + i] = d < start ? 0 : d > end ? PROJECT_LENGTH : ((d - start) / (end - start)) * PROJECT_LENGTH;
        });
      });
      data.push(pt);
    }
    return data;
  };

  const nextRound = () => {
    const res = { round };
    if (round === 2) Object.assign(res, r1Student);
    if (round === 3) Object.assign(res, { ...r2Student, cost: r2Cost.total });
    if (round === 4) Object.assign(res, { ...r3, buffer: r3Buffer });
    if (round === 5) Object.assign(res, { end: r4.end, cost: r4Cost.total });
    if (round === 6) Object.assign(res, { end: r5.end, cost: r5Cost.total, buffer: r5Buffer, pass: r5.end <= TARGET_DAYS && r5Cost.total <= TARGET_COST });
    setResults(p => ({ ...p, [round]: res }));
    setRound(round + 1);
  };

  const InputCell = ({ value, onChange, correct, submitted }) => {
    let bg = "bg-yellow-50 border-yellow-400";
    if (submitted) bg = parseInt(value) === correct ? "bg-green-100 border-green-500" : "bg-red-100 border-red-500";
    return <input type="number" value={value} onChange={onChange} className={`w-16 px-1 py-1 border-2 rounded text-center text-sm ${bg}`} />;
  };

  const BudgetTable = ({ cost, durExc, durPipe, durBack, costExc, costPipe, costBack }) => (
    <div className="grid grid-cols-2 gap-4 text-sm">
      <table className="w-full border"><tbody>
        <tr><td className="px-2 py-1 border">Mobilization</td><td className="px-2 py-1 border text-right">${MOB_COST.toLocaleString()}</td></tr>
        <tr><td className="px-2 py-1 border">Excavation ({durExc}d × ${costExc})</td><td className="px-2 py-1 border text-right">${cost.excC.toLocaleString()}</td></tr>
        <tr><td className="px-2 py-1 border">Pipe ({durPipe}d × ${costPipe})</td><td className="px-2 py-1 border text-right">${cost.pipeC.toLocaleString()}</td></tr>
        <tr><td className="px-2 py-1 border">Backfill ({durBack}d × ${costBack})</td><td className="px-2 py-1 border text-right">${cost.backC.toLocaleString()}</td></tr>
        <tr className="bg-gray-100 font-bold"><td className="px-2 py-1 border">Direct</td><td className="px-2 py-1 border text-right">${cost.direct.toLocaleString()}</td></tr>
      </tbody></table>
      <table className="w-full border"><tbody>
        <tr><td className="px-2 py-1 border">Direct</td><td className="px-2 py-1 border text-right">${cost.direct.toLocaleString()}</td></tr>
        <tr><td className="px-2 py-1 border">Indirect (30%)</td><td className="px-2 py-1 border text-right">${cost.indirect.toLocaleString()}</td></tr>
        <tr><td className="px-2 py-1 border">Profit (5%)</td><td className="px-2 py-1 border text-right">${cost.profit.toLocaleString()}</td></tr>
        <tr className="bg-green-100 font-bold text-lg"><td className="px-2 py-1 border">TOTAL</td><td className="px-2 py-1 border text-right">${cost.total.toLocaleString()}</td></tr>
      </tbody></table>
    </div>
  );

  // INTRO (round 0)
  if (round === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="text-center text-white mb-6"><h1 className="text-4xl font-bold">🎮 LOB SIMULATION GAME</h1><p className="text-blue-200">5-Round Educational Simulation</p></div>
          <div className="bg-white rounded-xl p-5">
            <h2 className="text-xl font-bold text-blue-900 border-b pb-2 mb-4">📋 PROJECT OVERVIEW</h2>
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4"><p className="text-sm leading-relaxed text-blue-900">This simulation places you in the role of a construction planner responsible for scheduling a major water pipeline project. Over five rounds, you will explore how crew productivity, spacing (buffers), and activity sequencing influence progress using the Line of Balance (LOB) method.</p></div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div className="bg-blue-50 p-3 rounded"><div className="text-gray-500">Project</div><div className="font-bold">College Station Water Pipeline</div></div>
              <div className="bg-blue-50 p-3 rounded"><div className="text-gray-500">Pipeline Type</div><div className="font-bold">24" Prestressed Concrete Cylinder Pipe</div></div>
              <div className="bg-blue-50 p-3 rounded"><div className="text-gray-500">Total Length</div><div className="font-bold text-xl">{PROJECT_LENGTH.toLocaleString()} ft</div></div>
              <div className="bg-blue-50 p-3 rounded"><div className="text-gray-500">Mobilization</div><div className="font-bold">{MOB_DAYS} days — ${MOB_COST.toLocaleString()}</div></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5">
            <h2 className="text-xl font-bold text-blue-900 border-b pb-2 mb-4">👷 CREW DEFINITIONS</h2>
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4"><p className="text-sm leading-relaxed text-blue-900">This project uses three sequential pipeline crews—Excavation, Pipe Laying, and Backfill—each with its own productivity and equipment.</p></div>
            <div className="space-y-3">
              <details className="group rounded-lg border border-blue-200 bg-blue-50 p-4">
                <summary className="flex cursor-pointer items-center justify-between list-none">
                  <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700">⛏️</div><div><div className="font-bold text-blue-900">Crew A — Excavation & Bedding</div><div className="text-xs text-blue-800/70">Uses Excavator</div></div></div>
                  <span className="text-blue-900/70 transition-transform group-open:rotate-180">▾</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-blue-900">Crew A uses an <strong>Excavator</strong> to dig the trench and prepare the bedding. As the first crew in sequence, it sets the pace for all other crews.</p>
              </details>
              <details className="group rounded-lg border border-green-200 bg-green-50 p-4">
                <summary className="flex cursor-pointer items-center justify-between list-none">
                  <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-green-700">🔧</div><div><div className="font-bold text-green-900">Crew B — Pipe Laying & Alignment</div><div className="text-xs text-green-800/70">Uses Mobile Crane</div></div></div>
                  <span className="text-green-900/70 transition-transform group-open:rotate-180">▾</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-green-900">Crew B uses a <strong>Mobile Crane</strong> to lift and align pipe sections in the trench prepared by Crew A.</p>
              </details>
              <details className="group rounded-lg border border-orange-200 bg-orange-50 p-4">
                <summary className="flex cursor-pointer items-center justify-between list-none">
                  <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-orange-700">🚜</div><div><div className="font-bold text-orange-900">Crew C — Backfill & Compaction</div><div className="text-xs text-orange-800/70">Uses Backfill Set</div></div></div>
                  <span className="text-orange-900/70 transition-transform group-open:rotate-180">▾</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-orange-900">Crew C uses a <strong>Backfill Set</strong> (Excavator + Compactor) to place and compact soil over installed pipes.</p>
              </details>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm font-bold table-auto">
                <thead className="bg-blue-100"><tr><th className="px-3 py-3 text-left">Crew</th><th className="px-3 py-3 text-left">Activity</th><th className="px-3 py-3 text-left">Equipment</th><th className="px-3 py-3 text-right">$/day</th><th className="px-3 py-3 text-right">ft/day</th></tr></thead>
                <tbody>
                  <tr className="bg-blue-50 border-b"><td className="px-3 py-3 text-blue-700">Crew A</td><td className="px-3 py-3">{CREWS.exc.name}</td><td className="px-3 py-3">{CREWS.exc.equipment}</td><td className="px-3 py-3 text-right">{CREWS.exc.cost}</td><td className="px-3 py-3 text-right">{CREWS.exc.rate}</td></tr>
                  <tr className="bg-green-50 border-b"><td className="px-3 py-3 text-green-700">Crew B</td><td className="px-3 py-3">{CREWS.pipe.name}</td><td className="px-3 py-3">{CREWS.pipe.equipment}</td><td className="px-3 py-3 text-right">{CREWS.pipe.cost}</td><td className="px-3 py-3 text-right">{CREWS.pipe.rate}</td></tr>
                  <tr className="bg-orange-50"><td className="px-3 py-3 text-orange-700">Crew C</td><td className="px-3 py-3">{CREWS.back.name}</td><td className="px-3 py-3">{CREWS.back.equipment}</td><td className="px-3 py-3 text-right">{CREWS.back.cost}</td><td className="px-3 py-3 text-right">{CREWS.back.rate}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5">
            <h2 className="text-xl font-bold text-blue-900 mb-4">🚀 Ready to Begin?</h2>
            <p className="text-gray-600 mb-4">Before starting the game, you'll complete a brief survey to help us understand your background.</p>
            <button onClick={() => setRound(1)} className="w-full bg-blue-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-blue-700">Begin Survey →</button>
          </div>
        </div>
      </div>
    );
  }

  // PRE-SURVEY (round 1)
  if (round === 1) return <PreSurvey sessionId={sessionId} onComplete={(data) => { setPreSurveyData(data); setRound(2); }} />;

  // GAME SUMMARY (round 7)
  if (round === 7) {
    const pass = results[6]?.pass;
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 p-4">
        <div className="max-w-4xl mx-auto bg-white rounded-xl p-6">
          <div className="text-center mb-6"><div className="text-6xl">{pass ? '🏆' : '📊'}</div><h1 className="text-3xl font-bold text-blue-900">Game Complete!</h1><p className="text-gray-600">Great job, {preSurveyData?.demographics?.name || 'Player'}!</p></div>
          <div className={`p-4 rounded-lg mb-6 ${pass ? 'bg-green-100 border-2 border-green-500' : 'bg-yellow-100 border-2 border-yellow-500'}`}>
            <h3 className="font-bold text-lg">{pass ? '✅ Constraints Met!' : '⚠️ Constraints Not Met'}</h3>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div>Duration: <span className={`font-bold ${results[6]?.end <= TARGET_DAYS ? 'text-green-600' : 'text-red-600'}`}>{results[6]?.end} days</span> <span className="text-gray-400">(≤{TARGET_DAYS})</span></div>
              <div>Cost: <span className={`font-bold ${results[6]?.cost <= TARGET_COST ? 'text-green-600' : 'text-red-600'}`}>${results[6]?.cost?.toLocaleString()}</span> <span className="text-gray-400">(≤${TARGET_COST.toLocaleString()})</span></div>
            </div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <h3 className="font-bold mb-2">📊 Results Summary</h3>
            <table className="w-full text-sm"><thead><tr className="text-left text-gray-500 border-b"><th className="py-2">Round</th><th>Duration</th><th>Cost</th><th>Notes</th></tr></thead>
              <tbody>
                <tr className="border-b"><td className="py-2">R1</td><td>{results[2]?.end || '-'}d</td><td>-</td><td>Initial</td></tr>
                <tr className="border-b"><td className="py-2">R2</td><td>{results[3]?.end || '-'}d</td><td>${results[3]?.cost?.toLocaleString() || '-'}</td><td>5-day buffer</td></tr>
                <tr className="border-b"><td className="py-2">R3</td><td>{results[4]?.end || '-'}d</td><td>-</td><td>Buffer: {results[4]?.buffer || '-'}</td></tr>
                <tr className="border-b"><td className="py-2">R4</td><td>{results[5]?.end || '-'}d</td><td>${results[5]?.cost?.toLocaleString() || '-'}</td><td>Equipment</td></tr>
                <tr className="font-bold bg-blue-100"><td className="py-2">R5</td><td>{results[6]?.end || '-'}d</td><td>${results[6]?.cost?.toLocaleString() || '-'}</td><td>{pass ? '✅' : '❌'}</td></tr>
              </tbody>
            </table>
          </div>
          <button onClick={() => setRound(8)} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700">Continue to Final Survey →</button>
        </div>
      </div>
    );
  }

  // POST-SURVEY (round 8)
  if (round === 8) return <PostSurvey sessionId={sessionId} playerName={preSurveyData?.demographics?.name || 'Player'} studentId={preSurveyData?.demographics?.studentId} onComplete={(data) => { setPostSurveyData(data); setRound(9); }} />;

  // THANK YOU (round 9)
  if (round === 9) return <ThankYou playerName={preSurveyData?.demographics?.name || 'Player'} preSurvey={preSurveyData} postSurvey={postSurveyData} gameResults={results} />;

  // GAME ROUNDS (2-6)
  const titles = { 2: 'R1: Bar Chart', 3: 'R2: LOB Analysis', 4: 'R3: Buffer', 5: 'R4: Rate', 6: 'R5: Optimize' };
  const playerName = preSurveyData?.demographics?.name || 'Player';

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-blue-900 text-white py-2 px-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <span><span className="text-blue-300">Player:</span> <strong>{playerName}</strong></span>
          <span className="font-bold">{titles[round]}</span>
          <div className="text-sm">🎯 ≤{TARGET_DAYS}d | 💰 ≤${TARGET_COST / 1000}K</div>
        </div>
      </div>
      <div className="bg-white border-b"><div className="max-w-5xl mx-auto px-4 py-2 flex gap-1">{[2,3,4,5,6].map(r => <div key={r} className={`flex-1 h-2 rounded ${r < round ? 'bg-green-500' : r === round ? 'bg-blue-500' : 'bg-gray-200'}`} />)}</div></div>

      <div className="max-w-5xl mx-auto p-4 space-y-4">
        {/* R1 */}
        {round === 2 && (
          <>
            <div className="bg-white rounded-lg shadow p-3 mb-4">
              <div className="flex items-center gap-2">
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${r1Step === 1 ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{r1Step === 1 ? '1️⃣' : '✅'} Quiz</div>
                <span className="text-gray-400">→</span>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${r1Step === 2 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'}`}>2️⃣ Scheduler</div>
              </div>
            </div>
            {r1Step === 1 && <QuizStep dur={dur} onComplete={() => setR1Step(2)} />}
            {r1Step === 2 && <SchedulerStep onComplete={(fs) => { setR1Input({ pipeS: String(fs.pipeS), backS: String(fs.backS) }); setResults(p => ({ ...p, 2: { round: 2, ...fs } })); setRound(3); }} />}
          </>
        )}

        {/* R2 */}
        {round === 3 && (
          <>
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded"><h3 className="font-bold">📋 R2: LOB Analysis</h3><p className="text-sm text-gray-600">Apply {DEFAULT_BUFFER}-day buffer.</p></div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-bold mb-2">Your R1 Schedule as LOB</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={genLOB([r1Student])} margin={{ top: 10, right: 30, bottom: 30, left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" label={{ value: 'Day', position: 'insideBottom', offset: -5 }} /><YAxis domain={[0, PROJECT_LENGTH]} tickFormatter={v => (v/1000).toFixed(0)+'k'} label={{ value: 'ft', angle: -90, position: 'insideLeft' }} /><Tooltip /><Legend verticalAlign="top" />
                  <Line type="linear" dataKey="exc0" stroke="#2563eb" strokeWidth={2} name="Excavation" dot={false} />
                  <Line type="linear" dataKey="pipe0" stroke="#16a34a" strokeWidth={2} name="Pipe Laying" dot={false} />
                  <Line type="linear" dataKey="back0" stroke="#ea580c" strokeWidth={2} name="Backfill" dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">⚠️ Must be revised with buffers.</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-bold mb-2">📐 Buffer Formulas</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-blue-50 p-3 rounded"><strong>Simple:</strong> Start = Prev Start + Buffer</div>
                <div className="bg-orange-50 p-3 rounded"><strong>Delayed:</strong> Start = Prev End + Buffer - Duration + 1</div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-bold mb-2">📝 Revise Schedule</h3>
              <table className="w-full text-sm border">
                <thead className="bg-gray-100"><tr><th className="px-2 py-2 border">Activity</th><th className="px-2 py-2 border">Rate</th><th className="px-2 py-2 border">Duration</th><th className="px-2 py-2 border bg-yellow-50">Start</th><th className="px-2 py-2 border bg-yellow-50">End</th></tr></thead>
                <tbody>
                  <tr className="bg-gray-50"><td className="px-2 py-2 border">Mobilization</td><td className="px-2 py-2 border text-center">-</td><td className="px-2 py-2 border text-center">{MOB_DAYS}</td><td className="px-2 py-2 border text-center">1</td><td className="px-2 py-2 border text-center">{MOB_DAYS}</td></tr>
                  <tr className="text-blue-700"><td className="px-2 py-2 border">Excavation</td><td className="px-2 py-2 border text-center">{CREWS.exc.rate}</td><td className="px-2 py-2 border text-center">{dur.exc}</td><td className="px-2 py-2 border text-center"><InputCell value={r2Input.excS} onChange={e => setR2Input({...r2Input, excS: e.target.value})} correct={r2Correct.excS} submitted={r2Validated} /></td><td className="px-2 py-2 border text-center"><InputCell value={r2Input.excE} onChange={e => setR2Input({...r2Input, excE: e.target.value})} correct={r2Correct.excE} submitted={r2Validated} /></td></tr>
                  <tr className="text-green-700"><td className="px-2 py-2 border">Pipe Laying</td><td className="px-2 py-2 border text-center">{CREWS.pipe.rate}</td><td className="px-2 py-2 border text-center">{dur.pipe}</td><td className="px-2 py-2 border text-center"><InputCell value={r2Input.pipeS} onChange={e => setR2Input({...r2Input, pipeS: e.target.value})} correct={r2Correct.pipeS} submitted={r2Validated} /></td><td className="px-2 py-2 border text-center"><InputCell value={r2Input.pipeE} onChange={e => setR2Input({...r2Input, pipeE: e.target.value})} correct={r2Correct.pipeE} submitted={r2Validated} /></td></tr>
                  <tr className="text-orange-700"><td className="px-2 py-2 border">Backfill</td><td className="px-2 py-2 border text-center">{CREWS.back.rate}</td><td className="px-2 py-2 border text-center">{dur.back}</td><td className="px-2 py-2 border text-center"><InputCell value={r2Input.backS} onChange={e => setR2Input({...r2Input, backS: e.target.value})} correct={r2Correct.backS} submitted={r2Validated} /></td><td className="px-2 py-2 border text-center"><InputCell value={r2Input.backE} onChange={e => setR2Input({...r2Input, backE: e.target.value})} correct={r2Correct.backE} submitted={r2Validated} /></td></tr>
                </tbody>
              </table>
              <button onClick={() => setR2Validated(true)} className="mt-3 px-4 py-2 bg-blue-500 text-white rounded font-bold">Check</button>
              {r2Validated && !r2IsCorrect && <div className="mt-2 p-2 bg-red-100 text-red-700 rounded">❌ Some incorrect</div>}
              {r2Validated && r2IsCorrect && <div className="mt-2 p-2 bg-green-100 text-green-700 rounded">✅ All correct!</div>}
            </div>
            {r2IsCorrect && (
              <>
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="font-bold mb-2">Revised LOB</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={genLOB([r2Student])} margin={{ top: 10, right: 30, bottom: 30, left: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis domain={[0, PROJECT_LENGTH]} tickFormatter={v => (v/1000).toFixed(0)+'k'} /><Tooltip /><Legend verticalAlign="top" />
                      <Line type="linear" dataKey="exc0" stroke="#2563eb" strokeWidth={2} name="Excavation" dot={false} />
                      <Line type="linear" dataKey="pipe0" stroke="#16a34a" strokeWidth={2} name="Pipe Laying" dot={false} />
                      <Line type="linear" dataKey="back0" stroke="#ea580c" strokeWidth={2} name="Backfill" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-white rounded-lg shadow p-4"><h3 className="font-bold mb-2">💰 Budget</h3><BudgetTable cost={r2Cost} durExc={dur.exc} durPipe={dur.pipe} durBack={dur.back} costExc={CREWS.exc.cost} costPipe={CREWS.pipe.cost} costBack={CREWS.back.cost} /></div>
              </>
            )}
            <button onClick={nextRound} disabled={!r2IsCorrect} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold disabled:bg-gray-300">{r2IsCorrect ? 'Complete R2 → R3' : 'Answer correctly'}</button>
          </>
        )}

        {/* R3 */}
        {round === 4 && (
          <>
            <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded"><h3 className="font-bold">📋 R3: Buffer Analysis</h3><p className="text-sm">See how buffer affects duration.</p></div>
            <div className="bg-white rounded-lg shadow p-4"><div className="flex items-center gap-4"><span className="font-bold">Buffer:</span><input type="range" min="1" max="15" value={r3Buffer} onChange={e => setR3Buffer(+e.target.value)} className="flex-1" /><span className="text-3xl font-bold text-green-600 w-16 text-center">{r3Buffer}</span><span>days</span></div></div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-bold mb-2">Schedule (Buffer = {r3Buffer})</h3>
              <table className="w-full text-sm border">
                <thead className="bg-gray-100"><tr><th className="px-2 py-2 border">Activity</th><th className="px-2 py-2 border">Rate</th><th className="px-2 py-2 border">Duration</th><th className="px-2 py-2 border">Start</th><th className="px-2 py-2 border">End</th></tr></thead>
                <tbody>
                  <tr className="bg-gray-50"><td className="px-2 py-2 border">Mobilization</td><td className="px-2 py-2 border text-center">-</td><td className="px-2 py-2 border text-center">{MOB_DAYS}</td><td className="px-2 py-2 border text-center">1</td><td className="px-2 py-2 border text-center">{MOB_DAYS}</td></tr>
                  <tr className="text-blue-700"><td className="px-2 py-2 border">Excavation</td><td className="px-2 py-2 border text-center">{CREWS.exc.rate}</td><td className="px-2 py-2 border text-center">{dur.exc}</td><td className="px-2 py-2 border text-center">{r3.excS}</td><td className="px-2 py-2 border text-center">{r3.excE}</td></tr>
                  <tr className="text-green-700"><td className="px-2 py-2 border">Pipe Laying</td><td className="px-2 py-2 border text-center">{CREWS.pipe.rate}</td><td className="px-2 py-2 border text-center">{dur.pipe}</td><td className="px-2 py-2 border text-center">{r3.pipeS}</td><td className="px-2 py-2 border text-center">{r3.pipeE}</td></tr>
                  <tr className="text-orange-700"><td className="px-2 py-2 border">Backfill</td><td className="px-2 py-2 border text-center">{CREWS.back.rate}</td><td className="px-2 py-2 border text-center">{dur.back}</td><td className="px-2 py-2 border text-center">{r3.backS}</td><td className="px-2 py-2 border text-center">{r3.backE}</td></tr>
                </tbody>
              </table>
              <div className="mt-3 text-center">Project End: <strong className="text-2xl text-green-600">{r3.end} days</strong></div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-bold mb-2">LOB: R2 (dashed) vs R3 (solid)</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={genLOB([r2Correct, r3])} margin={{ top: 10, right: 30, bottom: 30, left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis domain={[0, PROJECT_LENGTH]} tickFormatter={v => (v/1000).toFixed(0)+'k'} /><Tooltip /><Legend verticalAlign="top" />
                  <Line type="linear" dataKey="exc0" stroke="#2563eb" strokeWidth={1} strokeDasharray="5 5" name="Exc R2" dot={false} />
                  <Line type="linear" dataKey="pipe0" stroke="#16a34a" strokeWidth={1} strokeDasharray="5 5" name="Pipe R2" dot={false} />
                  <Line type="linear" dataKey="back0" stroke="#ea580c" strokeWidth={1} strokeDasharray="5 5" name="Back R2" dot={false} />
                  <Line type="linear" dataKey="exc1" stroke="#2563eb" strokeWidth={3} name="Exc R3" dot={false} />
                  <Line type="linear" dataKey="pipe1" stroke="#16a34a" strokeWidth={3} name="Pipe R3" dot={false} />
                  <Line type="linear" dataKey="back1" stroke="#ea580c" strokeWidth={3} name="Back R3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-yellow-50 p-4 rounded"><strong>💡 Key Insight:</strong> Buffer ↑ = Duration ↑, but Cost stays same!</div>
            <button onClick={nextRound} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold">Complete R3 → R4</button>
          </>
        )}

        {/* R4 */}
        {round === 5 && (
          <>
            <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded"><h3 className="font-bold">📋 R4: Rate Analysis</h3><p className="text-sm">Select equipment (1 each).</p></div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-bold mb-3">Equipment Selection</h3>
              <div className="grid grid-cols-3 gap-4">
                {['exc', 'pipe', 'back'].map(type => (
                  <div key={type} className="border rounded p-3">
                    <h4 className={`font-bold mb-2 ${type === 'exc' ? 'text-blue-700' : type === 'pipe' ? 'text-green-700' : 'text-orange-700'}`}>{type === 'exc' ? 'Excavation' : type === 'pipe' ? 'Pipe Laying' : 'Backfill'}</h4>
                    {EQUIPMENT[type].map((eq, i) => (
                      <label key={i} className={`block p-2 rounded mb-1 cursor-pointer ${r4Eq[type] === i ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-50'}`}>
                        <input type="radio" checked={r4Eq[type] === i} onChange={() => setR4Eq(p => ({...p, [type]: i}))} className="mr-2" />
                        {eq.name}<div className="text-xs text-gray-500 ml-5">{eq.rate} ft/d | ${eq.cost}/d</div>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-bold mb-2">R4 Schedule</h3>
              <table className="w-full text-sm border">
                <thead className="bg-gray-100"><tr><th className="px-2 py-1 border">Activity</th><th className="px-2 py-1 border">Equipment</th><th className="px-2 py-1 border">Rate</th><th className="px-2 py-1 border">Duration</th><th className="px-2 py-1 border">$/day</th><th className="px-2 py-1 border">Start</th><th className="px-2 py-1 border">End</th></tr></thead>
                <tbody>
                  <tr className="bg-gray-50"><td className="px-2 py-1 border">Mobilization</td><td className="px-2 py-1 border text-center">-</td><td className="px-2 py-1 border text-center">-</td><td className="px-2 py-1 border text-center">{MOB_DAYS}</td><td className="px-2 py-1 border text-center">-</td><td className="px-2 py-1 border text-center">1</td><td className="px-2 py-1 border text-center">{MOB_DAYS}</td></tr>
                  <tr className="text-blue-700"><td className="px-2 py-1 border">Excavation</td><td className="px-2 py-1 border text-center text-xs">{r4.excName}</td><td className="px-2 py-1 border text-center">{r4.excRate}</td><td className="px-2 py-1 border text-center font-bold">{r4.excDur}</td><td className="px-2 py-1 border text-center">${r4.excCost}</td><td className="px-2 py-1 border text-center">{r4.excS}</td><td className="px-2 py-1 border text-center">{r4.excE}</td></tr>
                  <tr className="text-green-700"><td className="px-2 py-1 border">Pipe Laying</td><td className="px-2 py-1 border text-center text-xs">{r4.pipeName}</td><td className="px-2 py-1 border text-center">{r4.pipeRate}</td><td className="px-2 py-1 border text-center font-bold">{r4.pipeDur}</td><td className="px-2 py-1 border text-center">${r4.pipeCost}</td><td className="px-2 py-1 border text-center">{r4.pipeS}</td><td className="px-2 py-1 border text-center">{r4.pipeE}</td></tr>
                  <tr className="text-orange-700"><td className="px-2 py-1 border">Backfill</td><td className="px-2 py-1 border text-center text-xs">{r4.backName}</td><td className="px-2 py-1 border text-center">{r4.backRate}</td><td className="px-2 py-1 border text-center font-bold">{r4.backDur}</td><td className="px-2 py-1 border text-center">${r4.backCost}</td><td className="px-2 py-1 border text-center">{r4.backS}</td><td className="px-2 py-1 border text-center">{r4.backE}</td></tr>
                </tbody>
              </table>
              <div className="mt-3 text-center">Project End: <strong className="text-2xl text-orange-600">{r4.end} days</strong></div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-bold mb-2">LOB: R2 (dashed) vs R4 (solid)</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={genLOB([r2Correct, r4])} margin={{ top: 10, right: 30, bottom: 30, left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis domain={[0, PROJECT_LENGTH]} tickFormatter={v => (v/1000).toFixed(0)+'k'} /><Tooltip /><Legend verticalAlign="top" />
                  <Line type="linear" dataKey="exc0" stroke="#2563eb" strokeWidth={1} strokeDasharray="5 5" name="Exc R2" dot={false} />
                  <Line type="linear" dataKey="pipe0" stroke="#16a34a" strokeWidth={1} strokeDasharray="5 5" name="Pipe R2" dot={false} />
                  <Line type="linear" dataKey="back0" stroke="#ea580c" strokeWidth={1} strokeDasharray="5 5" name="Back R2" dot={false} />
                  <Line type="linear" dataKey="exc1" stroke="#2563eb" strokeWidth={3} name="Exc R4" dot={false} />
                  <Line type="linear" dataKey="pipe1" stroke="#16a34a" strokeWidth={3} name="Pipe R4" dot={false} />
                  <Line type="linear" dataKey="back1" stroke="#ea580c" strokeWidth={3} name="Back R4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-lg shadow p-4"><h3 className="font-bold mb-2">💰 R4 Budget</h3><BudgetTable cost={r4Cost} durExc={r4.excDur} durPipe={r4.pipeDur} durBack={r4.backDur} costExc={r4.excCost} costPipe={r4.pipeCost} costBack={r4.backCost} /></div>
            <button onClick={nextRound} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold">Complete R4 → R5</button>
          </>
        )}

        {/* R5 */}
        {round === 6 && (
          <>
            <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded"><h3 className="font-bold">📋 R5: Optimization</h3><p className="text-sm">Meet: ≤{TARGET_DAYS} days and ≤${TARGET_COST.toLocaleString()}</p></div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-bold mb-3">Equipment (Multiple Units)</h3>
              <div className="grid grid-cols-3 gap-4">
                {['exc', 'pipe', 'back'].map(type => (
                  <div key={type} className={`border rounded p-3 ${type === 'exc' ? 'bg-blue-50' : type === 'pipe' ? 'bg-green-50' : 'bg-orange-50'}`}>
                    <h4 className={`font-bold mb-2 ${type === 'exc' ? 'text-blue-700' : type === 'pipe' ? 'text-green-700' : 'text-orange-700'}`}>{type === 'exc' ? 'Excavation' : type === 'pipe' ? 'Pipe Laying' : 'Backfill'}</h4>
                    {Object.keys(r5Config[type]).map(key => {
                      const eq = EQUIPMENT[type][type === 'pipe' ? (key === 'standard' ? 0 : 1) : (key === 'small' ? 0 : key === 'standard' ? 1 : 2)];
                      return (
                        <div key={key} className="flex items-center justify-between bg-white p-2 rounded mb-1">
                          <div className="text-sm">{eq.name}<div className="text-xs text-gray-500">{eq.rate} ft/d | ${eq.cost}/d</div></div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setR5Config(p => ({...p, [type]: {...p[type], [key]: Math.max(0, p[type][key] - 1)}}))} className="w-6 h-6 bg-gray-200 rounded font-bold">-</button>
                            <span className="w-6 text-center font-bold">{r5Config[type][key]}</span>
                            <button onClick={() => setR5Config(p => ({...p, [type]: {...p[type], [key]: p[type][key] + 1}}))} className="w-6 h-6 bg-blue-200 rounded font-bold">+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-purple-50 rounded flex items-center gap-4"><span className="font-bold">Buffer:</span><input type="range" min="1" max="10" value={r5Buffer} onChange={e => setR5Buffer(+e.target.value)} className="flex-1" /><span className="text-2xl font-bold text-purple-600 w-12">{r5Buffer}</span></div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-bold mb-2">R5 Schedule</h3>
              <table className="w-full text-sm border">
                <thead className="bg-gray-100"><tr><th className="px-2 py-1 border">Activity</th><th className="px-2 py-1 border">Rate</th><th className="px-2 py-1 border">Duration</th><th className="px-2 py-1 border">$/day</th><th className="px-2 py-1 border">Start</th><th className="px-2 py-1 border">End</th></tr></thead>
                <tbody>
                  <tr className="bg-gray-50"><td className="px-2 py-1 border">Mobilization</td><td className="px-2 py-1 border text-center">-</td><td className="px-2 py-1 border text-center">{MOB_DAYS}</td><td className="px-2 py-1 border text-center">-</td><td className="px-2 py-1 border text-center">1</td><td className="px-2 py-1 border text-center">{MOB_DAYS}</td></tr>
                  <tr className="text-blue-700"><td className="px-2 py-1 border">Excavation</td><td className="px-2 py-1 border text-center">{r5.excRate}</td><td className="px-2 py-1 border text-center font-bold">{r5.excDur}</td><td className="px-2 py-1 border text-center">${r5.excCost}</td><td className="px-2 py-1 border text-center">{r5.excS}</td><td className="px-2 py-1 border text-center">{r5.excE}</td></tr>
                  <tr className="text-green-700"><td className="px-2 py-1 border">Pipe Laying</td><td className="px-2 py-1 border text-center">{r5.pipeRate}</td><td className="px-2 py-1 border text-center font-bold">{r5.pipeDur}</td><td className="px-2 py-1 border text-center">${r5.pipeCost}</td><td className="px-2 py-1 border text-center">{r5.pipeS}</td><td className="px-2 py-1 border text-center">{r5.pipeE}</td></tr>
                  <tr className="text-orange-700"><td className="px-2 py-1 border">Backfill</td><td className="px-2 py-1 border text-center">{r5.backRate}</td><td className="px-2 py-1 border text-center font-bold">{r5.backDur}</td><td className="px-2 py-1 border text-center">${r5.backCost}</td><td className="px-2 py-1 border text-center">{r5.backS}</td><td className="px-2 py-1 border text-center">{r5.backE}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-bold mb-2">📈 R5 LOB</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={genLOB([r5])} margin={{ top: 10, right: 30, bottom: 30, left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis domain={[0, PROJECT_LENGTH]} tickFormatter={v => (v/1000).toFixed(0)+'k'} /><Tooltip /><Legend verticalAlign="top" />
                  <Line type="linear" dataKey="exc0" stroke="#2563eb" strokeWidth={3} name="Excavation" dot={false} />
                  <Line type="linear" dataKey="pipe0" stroke="#16a34a" strokeWidth={3} name="Pipe Laying" dot={false} />
                  <Line type="linear" dataKey="back0" stroke="#ea580c" strokeWidth={3} name="Backfill" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-bold mb-2">Constraints Check</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 rounded-lg text-center ${r5.end <= TARGET_DAYS ? 'bg-green-100 border-2 border-green-500' : 'bg-red-100 border-2 border-red-500'}`}><div className="text-gray-600">Duration</div><div className={`text-3xl font-bold ${r5.end <= TARGET_DAYS ? 'text-green-600' : 'text-red-600'}`}>{r5.end} days</div><div className="text-sm">≤{TARGET_DAYS} {r5.end <= TARGET_DAYS ? '✅' : '❌'}</div></div>
                <div className={`p-4 rounded-lg text-center ${r5Cost.total <= TARGET_COST ? 'bg-green-100 border-2 border-green-500' : 'bg-red-100 border-2 border-red-500'}`}><div className="text-gray-600">Total Cost</div><div className={`text-3xl font-bold ${r5Cost.total <= TARGET_COST ? 'text-green-600' : 'text-red-600'}`}>${(r5Cost.total/1000).toFixed(0)}K</div><div className="text-sm">≤${TARGET_COST/1000}K {r5Cost.total <= TARGET_COST ? '✅' : '❌'}</div></div>
              </div>
              {(r5.end > TARGET_DAYS || r5Cost.total > TARGET_COST) && <div className="mt-3 p-3 bg-yellow-100 border border-yellow-400 rounded text-yellow-800 font-bold text-center">⚠️ Keep optimizing...</div>}
            </div>
            <div className="bg-white rounded-lg shadow p-4"><h3 className="font-bold mb-2">💰 R5 Budget</h3><BudgetTable cost={r5Cost} durExc={r5.excDur} durPipe={r5.pipeDur} durBack={r5.backDur} costExc={r5.excCost} costPipe={r5.pipeCost} costBack={r5.backCost} /></div>
            <button onClick={nextRound} className="w-full bg-purple-600 text-white py-3 rounded-lg font-bold">Finish Game 🏆</button>
          </>
        )}
      </div>
    </div>
  );
}
