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

const CORRECT_DURATIONS = {
  exc: Math.ceil(PROJECT_LENGTH / CREWS.exc.rate),
  pipe: Math.ceil(PROJECT_LENGTH / CREWS.pipe.rate),
  back: Math.ceil(PROJECT_LENGTH / CREWS.back.rate),
};

// ==================== SURVEY QUESTIONS ====================
const KNOWLEDGE_QUESTIONS = [
  { id: 'K1', question: 'What is the correct sequence of pipeline construction activities?', 
    options: [
      { value: 'a', label: 'Backfill → Pipe Laying → Excavation' }, 
      { value: 'b', label: 'Pipe Laying → Excavation → Backfill' }, 
      { value: 'c', label: 'Excavation → Pipe Laying → Backfill' }, 
      { value: 'd', label: 'Any order works' }
    ], correct: 'c' },
  { id: 'K2', question: 'In a Line of Balance (LOB) chart, what does a steeper slope indicate?', 
    options: [
      { value: 'a', label: 'Slower production rate' }, 
      { value: 'b', label: 'Faster production rate' }, 
      { value: 'c', label: 'Higher cost' }, 
      { value: 'd', label: 'Longer duration' }
    ], correct: 'b' },
  { id: 'K3', question: 'What does it mean when two LOB lines cross each other?', 
    options: [
      { value: 'a', label: 'Activities are on schedule' }, 
      { value: 'b', label: 'A conflict exists (crews at same location)' }, 
      { value: 'c', label: 'Buffer is too large' }, 
      { value: 'd', label: 'Project is complete' }
    ], correct: 'b' },
  { id: 'K4', question: 'What is the primary purpose of a buffer in LOB scheduling?', 
    options: [
      { value: 'a', label: 'Increase project cost' }, 
      { value: 'b', label: 'Make the chart look better' }, 
      { value: 'c', label: 'Prevent crew conflicts and provide safety margin' }, 
      { value: 'd', label: 'Reduce equipment needs' }
    ], correct: 'c' },
  { id: 'K5', question: 'If you increase the buffer size between activities, what happens to project duration?', 
    options: [
      { value: 'a', label: 'Duration decreases' }, 
      { value: 'b', label: 'Duration increases' }, 
      { value: 'c', label: 'Duration stays the same' }, 
      { value: 'd', label: 'Duration becomes unpredictable' }
    ], correct: 'b' },
  { id: 'K6', question: 'If you increase the buffer size between activities, what happens to total cost?', 
    options: [
      { value: 'a', label: 'Cost increases' }, 
      { value: 'b', label: 'Cost decreases' }, 
      { value: 'c', label: 'Cost stays the same' }, 
      { value: 'd', label: 'Cost becomes unpredictable' }
    ], correct: 'c' },
  { id: 'K7', question: 'If you use faster equipment (higher production rate), what happens to duration?', 
    options: [
      { value: 'a', label: 'Duration decreases' }, 
      { value: 'b', label: 'Duration increases' }, 
      { value: 'c', label: 'Duration stays the same' }, 
      { value: 'd', label: 'Duration becomes unpredictable' }
    ], correct: 'a' },
  { id: 'K8', question: 'How do you calculate activity duration from project length and production rate?', 
    options: [
      { value: 'a', label: 'Duration = Project Length × Rate' }, 
      { value: 'b', label: 'Duration = Rate ÷ Project Length' }, 
      { value: 'c', label: 'Duration = Project Length ÷ Rate (rounded up)' }, 
      { value: 'd', label: 'Duration = Project Length - Rate' }
    ], correct: 'c' },
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

// ==================== HELPER FUNCTIONS ====================
const calculateKnowledgeScore = (answers) => {
  return KNOWLEDGE_QUESTIONS.reduce((score, q) => score + (answers[q.id] === q.correct ? 1 : 0), 0);
};

const calculateMeanScore = (answers, questions) => {
  const values = questions.map(q => answers[q.id] || 0).filter(v => v > 0);
  return values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : '0.00';
};

const submitToGoogleSheets = async (type, data) => {
  if (GOOGLE_SCRIPT_URL === 'YOUR_GOOGLE_SCRIPT_URL_HERE') {
    console.log('[DEV MODE] Would submit to Google Sheets:', type, data);
    return { success: true, dev: true };
  }
  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...data })
    });
    return { success: true };
  } catch (error) {
    console.error('Google Sheets submission error:', error);
    return { success: false, error };
  }
};

const findConflicts = (schedule, durations) => {
  const conflicts = [];
  const rates = { exc: CREWS.exc.rate, pipe: CREWS.pipe.rate, back: CREWS.back.rate };
  const pairs = [
    { a: 'exc', b: 'pipe', aName: 'Excavation', bName: 'Pipe Laying' },
    { a: 'pipe', b: 'back', aName: 'Pipe Laying', bName: 'Backfill' },
  ];
  pairs.forEach(({ a, b, aName, bName }) => {
    const aS = schedule[a + 'S'], aE = schedule[a + 'E'];
    const bS = schedule[b + 'S'], bE = schedule[b + 'E'];
    if (!aS || !bS || aS <= 0 || bS <= 0) return;
    const aRate = rates[a], bRate = rates[b];
    const maxEnd = Math.max(aE, bE);
    let prevDiff = null;
    for (let d = Math.min(aS, bS); d <= maxEnd; d++) {
      const aPos = d < aS ? 0 : d > aE ? PROJECT_LENGTH : Math.min((d - aS + 1) * aRate, PROJECT_LENGTH);
      const bPos = d < bS ? 0 : d > bE ? PROJECT_LENGTH : Math.min((d - bS + 1) * bRate, PROJECT_LENGTH);
      const diff = bPos - aPos;
      if (prevDiff !== null && prevDiff <= 0 && diff > 0) {
        conflicts.push({ day: d, dist: Math.round(aPos), aName, bName, a, b });
      }
      prevDiff = diff;
    }
    if (bS <= aS) {
      const bDaysWorked = aS - bS + 1;
      const bPos1 = bS <= aS ? Math.min(bDaysWorked * bRate, PROJECT_LENGTH) : 0;
      if (bPos1 > 0 && aS >= bS) {
        conflicts.push({ day: aS, dist: 0, aName, bName, a, b });
      }
    }
  });
  return conflicts;
};


// ==================== POST-SURVEY COMPONENT ====================
function PostSurvey({ onComplete, sessionId, playerName, studentId, preKnowledgeScore, preSEScore }) {
  const [step, setStep] = useState(1);
  const [knowledge, setKnowledge] = useState({});
  const [selfEfficacy, setSelfEfficacy] = useState({});
  const [experience, setExperience] = useState({});
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isKnowledgeComplete = KNOWLEDGE_QUESTIONS.every(q => knowledge[q.id]);
  const isSEComplete = SELF_EFFICACY_QUESTIONS.every(q => selfEfficacy[q.id]);
  const isEXComplete = EXPERIENCE_QUESTIONS.every(q => experience[q.id]);

  const handleSubmit = async () => {
    setSubmitting(true);
    const knowledgeScore = calculateKnowledgeScore(knowledge);
    const seScore = calculateMeanScore(selfEfficacy, SELF_EFFICACY_QUESTIONS);
    const exScore = calculateMeanScore(experience, EXPERIENCE_QUESTIONS);
    const knowledgeGain = knowledgeScore - preKnowledgeScore;
    const seGain = (parseFloat(seScore) - parseFloat(preSEScore)).toFixed(2);
    await submitToGoogleSheets('post-survey', { sessionId, timestamp: new Date().toISOString(), studentId, knowledge, knowledgeScore, knowledgeGain, selfEfficacy, seScore, seGain, experience, exScore, comments });
    onComplete({ knowledge, knowledgeScore, knowledgeGain, selfEfficacy, seScore, seGain, experience, exScore, comments });
  };

  const getOptionClass = (selected, isThis) => `block w-full p-3 rounded-lg border-2 cursor-pointer text-left ${isThis ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-600 p-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center text-white mb-6">
          <h1 className="text-3xl font-bold">📝 Post-Game Survey</h1>
          <p className="text-green-200">Almost done, {playerName}!</p>
        </div>

        <div className="bg-white rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between text-sm">
            {[{ n: 1, t: 'Knowledge' }, { n: 2, t: 'Confidence' }, { n: 3, t: 'Experience' }].map((s, i) => (
              <React.Fragment key={s.n}>
                <div className={`flex items-center gap-2 ${step >= s.n ? 'text-green-600 font-bold' : 'text-gray-400'}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= s.n ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>{s.n}</span>
                  {s.t}
                </div>
                {i < 2 && <div className="flex-1 h-1 mx-2 bg-gray-200"><div className={`h-full bg-green-600 transition-all ${step > s.n ? 'w-full' : 'w-0'}`} /></div>}
              </React.Fragment>
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="bg-white rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-green-900 border-b pb-2">Section 1: Knowledge Assessment</h2>
            <p className="text-sm text-gray-600">Same questions as before - let's see what you learned!</p>
            {KNOWLEDGE_QUESTIONS.map((q, idx) => (
              <div key={q.id} className="border rounded-lg p-4">
                <h3 className="font-bold mb-3">{idx + 1}. {q.question}</h3>
                <div className="space-y-2">{q.options.map(opt => (<label key={opt.value} className={getOptionClass(knowledge[q.id], knowledge[q.id] === opt.value)}><input type="radio" name={`post-${q.id}`} value={opt.value} checked={knowledge[q.id] === opt.value} onChange={e => setKnowledge({ ...knowledge, [q.id]: e.target.value })} className="mr-2" /><span className="font-medium">{opt.value.toUpperCase()})</span> {opt.label}</label>))}</div>
              </div>
            ))}
            <button onClick={() => setStep(2)} disabled={!isKnowledgeComplete} className={`w-full py-3 rounded-lg font-bold ${isKnowledgeComplete ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>Continue →</button>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-green-900 border-b pb-2">Section 2: Confidence Level</h2>
            <p className="text-sm text-gray-600">Rate your confidence NOW after playing the game</p>
            {SELF_EFFICACY_QUESTIONS.map((q, idx) => (
              <div key={q.id} className="border rounded-lg p-4">
                <h3 className="font-medium mb-3">{idx + 1}. {q.question}</h3>
                <div className="flex justify-between gap-2">{[1, 2, 3, 4, 5].map(n => (<label key={n} className={`flex-1 flex flex-col items-center cursor-pointer p-3 rounded-lg border-2 ${selfEfficacy[q.id] === n ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}><input type="radio" className="sr-only" checked={selfEfficacy[q.id] === n} onChange={() => setSelfEfficacy({ ...selfEfficacy, [q.id]: n })} /><span className={`text-2xl font-bold ${selfEfficacy[q.id] === n ? 'text-green-600' : 'text-gray-400'}`}>{n}</span><span className="text-xs text-gray-500 mt-1">{n === 1 ? 'Low' : n === 5 ? 'High' : ''}</span></label>))}</div>
              </div>
            ))}
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-lg font-bold border-2 hover:bg-gray-50">← Back</button>
              <button onClick={() => setStep(3)} disabled={!isSEComplete} className={`flex-1 py-3 rounded-lg font-bold ${isSEComplete ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>Continue →</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="bg-white rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-green-900 border-b pb-2">Section 3: Game Experience</h2>
            <p className="text-sm text-gray-600">Rate your experience (1 = Strongly Disagree, 5 = Strongly Agree)</p>
            {EXPERIENCE_QUESTIONS.map((q, idx) => (
              <div key={q.id} className="border rounded-lg p-4">
                <h3 className="font-medium mb-3">{idx + 1}. {q.question}</h3>
                <div className="flex justify-between gap-2">{[1, 2, 3, 4, 5].map(n => (<label key={n} className={`flex-1 flex flex-col items-center cursor-pointer p-3 rounded-lg border-2 ${experience[q.id] === n ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}><input type="radio" className="sr-only" checked={experience[q.id] === n} onChange={() => setExperience({ ...experience, [q.id]: n })} /><span className={`text-2xl font-bold ${experience[q.id] === n ? 'text-green-600' : 'text-gray-400'}`}>{n}</span><span className="text-xs text-gray-500 mt-1">{n === 1 ? 'Disagree' : n === 5 ? 'Agree' : ''}</span></label>))}</div>
              </div>
            ))}
            <div><label className="block text-sm font-medium mb-1">Any additional comments? (Optional)</label><textarea value={comments} onChange={e => setComments(e.target.value)} className="w-full px-3 py-2 border-2 rounded-lg" rows={4} placeholder="What did you like? What could be improved?" /></div>
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-lg font-bold border-2 hover:bg-gray-50">← Back</button>
              <button onClick={handleSubmit} disabled={!isEXComplete || submitting} className={`flex-1 py-3 rounded-lg font-bold ${isEXComplete && !submitting ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>{submitting ? '⏳ Submitting...' : '✅ Complete Survey'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== THANK YOU COMPONENT ====================
function ThankYou() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-purple-700 p-4 flex items-center justify-center">
      <div className="max-w-xl w-full bg-white rounded-xl p-8 text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-3xl font-bold text-purple-900 mb-2">Thank You!</h1>
        <p className="text-gray-600 mb-6">You have completed the LOB Simulation Game and all surveys.</p>
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-6">
          <div className="text-green-700 font-bold text-lg">✅ Your responses have been recorded</div>
          <p className="text-green-600 text-sm mt-1">Thank you for participating in this research study!</p>
        </div>
        <button onClick={() => window.location.reload()} className="px-8 py-3 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700">🔄 Play Again</button>
      </div>
    </div>
  );
}

// ==================== PRE-SURVEY COMPONENT ====================
function PreSurvey({ onComplete, sessionId }) {
  const [step, setStep] = useState(1);
  const [demographics, setDemographics] = useState({
    studentId: '', name: '', program: '', major: '', priorCourses: '', lobFamiliarity: ''
  });
  const [knowledge, setKnowledge] = useState({});
  const [selfEfficacy, setSelfEfficacy] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const isDemoComplete = demographics.studentId && demographics.name && demographics.program && 
    demographics.major && demographics.priorCourses && demographics.lobFamiliarity;
  const isKnowledgeComplete = KNOWLEDGE_QUESTIONS.every(q => knowledge[q.id]);
  const isSEComplete = SELF_EFFICACY_QUESTIONS.every(q => selfEfficacy[q.id]);

  const handleSubmit = async () => {
    setSubmitting(true);
    const knowledgeScore = calculateKnowledgeScore(knowledge);
    const seScore = calculateMeanScore(selfEfficacy, SELF_EFFICACY_QUESTIONS);
    const data = { sessionId, timestamp: new Date().toISOString(), ...demographics, knowledge, knowledgeScore, selfEfficacy, seScore };
    await submitToGoogleSheets('pre-survey', data);
    onComplete({ demographics, knowledge, knowledgeScore, selfEfficacy, seScore });
  };

  const getOptionClass = (selected, current) => {
    const base = 'block p-3 rounded-lg border-2 cursor-pointer transition-all text-left w-full';
    return selected === current ? `${base} border-blue-500 bg-blue-50` : `${base} border-gray-200 hover:border-blue-300`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 p-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center text-white mb-6">
          <h1 className="text-3xl font-bold">Pre-Game Survey</h1>
          <p className="text-blue-200">Please complete before starting the game</p>
        </div>

        <div className="bg-white rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between text-sm">
            {[{ n: 1, t: 'About You' }, { n: 2, t: 'Knowledge' }, { n: 3, t: 'Confidence' }].map((s, i) => (
              <React.Fragment key={s.n}>
                <div className={`flex items-center gap-2 ${step >= s.n ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= s.n ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>{s.n}</span>
                  {s.t}
                </div>
                {i < 2 && <div className="flex-1 h-1 mx-2 bg-gray-200"><div className={`h-full bg-blue-600 transition-all ${step > s.n ? 'w-full' : 'w-0'}`} /></div>}
              </React.Fragment>
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="bg-white rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-blue-900 border-b pb-2">Section 1: About You</h2>
            <div>
              <label className="block text-sm font-medium mb-1">Student ID (UIN) *</label>
              <input type="text" value={demographics.studentId} onChange={e => setDemographics({ ...demographics, studentId: e.target.value })} className="w-full px-3 py-2 border-2 rounded-lg" placeholder="Enter your student ID" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Your Name *</label>
              <input type="text" value={demographics.name} onChange={e => setDemographics({ ...demographics, name: e.target.value })} className="w-full px-3 py-2 border-2 rounded-lg" placeholder="Enter your name" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Academic Program *</label>
              <div className="space-y-2">
                {['Undergraduate', "Master's", 'PhD', 'Other'].map(opt => (
                  <label key={opt} className={getOptionClass(demographics.program, opt)}>
                    <input type="radio" name="program" value={opt} checked={demographics.program === opt} onChange={e => setDemographics({ ...demographics, program: e.target.value })} className="mr-2" />{opt}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Major / Field of Study *</label>
              <div className="space-y-2">
                {['Construction Science', 'Construction Management', 'Civil Engineering', 'Other'].map(opt => (
                  <label key={opt} className={getOptionClass(demographics.major, opt)}>
                    <input type="radio" name="major" value={opt} checked={demographics.major === opt} onChange={e => setDemographics({ ...demographics, major: e.target.value })} className="mr-2" />{opt}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Have you taken any construction scheduling courses before? *</label>
              <div className="flex gap-4">
                {['Yes', 'No'].map(opt => (
                  <label key={opt} className={`flex-1 p-3 rounded-lg border-2 cursor-pointer text-center ${demographics.priorCourses === opt ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                    <input type="radio" name="priorCourses" value={opt} checked={demographics.priorCourses === opt} onChange={e => setDemographics({ ...demographics, priorCourses: e.target.value })} className="mr-2" />{opt}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">How familiar are you with Line of Balance (LOB) scheduling? *</label>
              <div className="space-y-2">
                {[{ v: 'never', l: 'Never heard of it' }, { v: 'heard', l: 'Heard of it but never used it' }, { v: 'class', l: 'Used it in class/assignments' }, { v: 'work', l: 'Used it in real projects' }].map(opt => (
                  <label key={opt.v} className={getOptionClass(demographics.lobFamiliarity, opt.v)}>
                    <input type="radio" name="lobFamiliarity" value={opt.v} checked={demographics.lobFamiliarity === opt.v} onChange={e => setDemographics({ ...demographics, lobFamiliarity: e.target.value })} className="mr-2" />{opt.l}
                  </label>
                ))}
              </div>
            </div>
            <button onClick={() => setStep(2)} disabled={!isDemoComplete} className={`w-full py-3 rounded-lg font-bold text-lg ${isDemoComplete ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>Continue to Knowledge Questions</button>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-blue-900 border-b pb-2">Section 2: Knowledge Assessment</h2>
            <p className="text-sm text-gray-600">Select the best answer for each question.</p>
            {KNOWLEDGE_QUESTIONS.map((q, idx) => (
              <div key={q.id} className="border rounded-lg p-4">
                <h3 className="font-bold mb-3">{idx + 1}. {q.question}</h3>
                <div className="space-y-2">
                  {q.options.map(opt => (
                    <label key={opt.value} className={getOptionClass(knowledge[q.id], opt.value)}>
                      <input type="radio" name={q.id} value={opt.value} checked={knowledge[q.id] === opt.value} onChange={e => setKnowledge({ ...knowledge, [q.id]: e.target.value })} className="mr-2" />
                      <span className="font-medium">{opt.value.toUpperCase()})</span> {opt.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-lg font-bold border-2 hover:bg-gray-50">Back</button>
              <button onClick={() => setStep(3)} disabled={!isKnowledgeComplete} className={`flex-1 py-3 rounded-lg font-bold ${isKnowledgeComplete ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>Continue</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="bg-white rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-blue-900 border-b pb-2">Section 3: Confidence Level</h2>
            <p className="text-sm text-gray-600">Rate your confidence in performing each task (1 = Not confident at all, 5 = Very confident)</p>
            {SELF_EFFICACY_QUESTIONS.map((q, idx) => (
              <div key={q.id} className="border rounded-lg p-4">
                <h3 className="font-medium mb-3">{idx + 1}. {q.question}</h3>
                <div className="flex justify-between gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <label key={n} className={`flex-1 flex flex-col items-center cursor-pointer p-3 rounded-lg border-2 ${selfEfficacy[q.id] === n ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                      <input type="radio" className="sr-only" checked={selfEfficacy[q.id] === n} onChange={() => setSelfEfficacy({ ...selfEfficacy, [q.id]: n })} />
                      <span className={`text-2xl font-bold ${selfEfficacy[q.id] === n ? 'text-blue-600' : 'text-gray-400'}`}>{n}</span>
                      <span className="text-xs text-gray-500 mt-1">{n === 1 ? 'Low' : n === 5 ? 'High' : ''}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-lg font-bold border-2 hover:bg-gray-50">Back</button>
              <button onClick={handleSubmit} disabled={!isSEComplete || submitting} className={`flex-1 py-3 rounded-lg font-bold ${isSEComplete && !submitting ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>{submitting ? 'Submitting...' : 'Start Game'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ==================== FLASH CARD COMPONENT ====================
function FlashCard({ title, icon, isOpen, onToggle, children }) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors">
        <span className="font-medium">{icon} {title}</span>
        <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {isOpen && <div className="p-4 bg-white border-t border-gray-200 text-sm text-gray-700">{children}</div>}
    </div>
  );
}

// ==================== DRAGGABLE BAR CHART ====================
function DraggableBarChart({ schedule, durations, onScheduleChange }) {
  const chartRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);

  const CHART_WIDTH = 700, CHART_PADDING_LEFT = 180, MAX_DAY = 160;
  const USABLE_WIDTH = CHART_WIDTH - CHART_PADDING_LEFT - 20;
  const PIXELS_PER_DAY = USABLE_WIDTH / MAX_DAY;
  const BAR_HEIGHT = 36, BAR_GAP = 12;
  const CHART_HEIGHT = 4 * (BAR_HEIGHT + BAR_GAP) + 60;

  const dayToPixel = (day) => CHART_PADDING_LEFT + day * PIXELS_PER_DAY;
  const pixelToDay = (pixel) => Math.max(1, Math.min(Math.round((pixel - CHART_PADDING_LEFT) / PIXELS_PER_DAY), MAX_DAY - 20));

  const handleDragStart = (barType, clientX) => {
    const rect = chartRef.current.getBoundingClientRect();
    const posX = clientX - rect.left;
    let currentStart = barType === 'exc' ? schedule.excStart : barType === 'pipe' ? schedule.pipeStart : schedule.backStart;
    if (!currentStart || currentStart < 1) currentStart = 1;
    setDragOffset(posX - dayToPixel(currentStart));
    setDragging(barType);
  };

  const handleMouseDown = (barType, e) => { e.preventDefault(); handleDragStart(barType, e.clientX); };
  const handleTouchStart = (barType, e) => { e.preventDefault(); handleDragStart(barType, e.touches[0].clientX); };

  const handleDragMove = useCallback((clientX) => {
    if (!dragging || !chartRef.current) return;
    const rect = chartRef.current.getBoundingClientRect();
    const newDay = pixelToDay(clientX - rect.left - dragOffset);
    if (dragging === 'exc') onScheduleChange({ ...schedule, excStart: newDay });
    else if (dragging === 'pipe') onScheduleChange({ ...schedule, pipeStart: newDay });
    else if (dragging === 'back') onScheduleChange({ ...schedule, backStart: newDay });
  }, [dragging, dragOffset, schedule, onScheduleChange]);

  const handleMouseMove = useCallback((e) => handleDragMove(e.clientX), [handleDragMove]);
  const handleTouchMove = useCallback((e) => { e.preventDefault(); handleDragMove(e.touches[0].clientX); }, [handleDragMove]);
  const handleDragEnd = useCallback(() => setDragging(null), []);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleDragEnd);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleDragEnd); window.removeEventListener('touchmove', handleTouchMove); window.removeEventListener('touchend', handleDragEnd); };
  }, [dragging, handleMouseMove, handleTouchMove, handleDragEnd]);

  const bars = [
    { id: 'mob', label: 'Mobilization', start: 1, duration: MOB_DAYS, color: 'bg-gray-400', locked: true, show: true },
    { id: 'exc', label: 'Excavation & Bedding', start: schedule.excStart || 0, duration: durations.exc, color: 'bg-blue-500', locked: false, show: durations.exc > 0 && schedule.excStart > 0 },
    { id: 'pipe', label: 'Pipe Laying & Alignment', start: schedule.pipeStart || 0, duration: durations.pipe, color: 'bg-green-500', locked: false, show: durations.pipe > 0 && schedule.pipeStart > 0 },
    { id: 'back', label: 'Backfill & Compaction', start: schedule.backStart || 0, duration: durations.back, color: 'bg-orange-500', locked: false, show: durations.back > 0 && schedule.backStart > 0 },
  ];

  const xTicks = [0, 20, 40, 60, 80, 100, 120, 140, 160];

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-4 mb-4 text-sm justify-center">
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-400 rounded"></div><span>Mobilization</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-blue-500 rounded"></div><span>Excavation</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-green-500 rounded"></div><span>Pipe Laying</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-orange-500 rounded"></div><span>Backfill</span></div>
      </div>
      <div className="overflow-x-auto pb-2">
        <div ref={chartRef} className="relative bg-gray-50 rounded-lg border" style={{ width: CHART_WIDTH, height: CHART_HEIGHT, margin: '0 auto', minWidth: CHART_WIDTH, touchAction: 'pan-x' }}>
          {xTicks.map(day => (<div key={`grid-${day}`} className="absolute w-px bg-gray-200" style={{ left: dayToPixel(day), top: 10, bottom: 40 }} />))}
          {bars.map((bar, index) => (<div key={`label-${bar.id}`} className="absolute text-sm text-gray-700 text-right pr-3" style={{ left: 20, width: CHART_PADDING_LEFT - 30, top: index * (BAR_HEIGHT + BAR_GAP) + 20 + BAR_HEIGHT / 2 - 10 }}>{bar.label}</div>))}
          {bars.map((bar, index) => (
            bar.show ? (
              <div key={bar.id} className={`absolute ${bar.color} rounded flex items-center justify-center text-white text-xs font-bold shadow ${bar.locked ? 'cursor-not-allowed opacity-80' : 'cursor-grab active:cursor-grabbing hover:shadow-lg'} ${dragging === bar.id ? 'ring-4 ring-yellow-400 shadow-xl z-10' : ''}`}
                style={{ left: dayToPixel(bar.start), width: Math.max(bar.duration * PIXELS_PER_DAY, 40), height: BAR_HEIGHT, top: index * (BAR_HEIGHT + BAR_GAP) + 20, touchAction: 'none' }}
                onMouseDown={bar.locked ? undefined : (e) => handleMouseDown(bar.id, e)} onTouchStart={bar.locked ? undefined : (e) => handleTouchStart(bar.id, e)}>
                {bar.locked && <span className="mr-1">🔒</span>}{bar.start} - {bar.start + bar.duration - 1}
              </div>
            ) : (<div key={bar.id} className="absolute bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs border-2 border-dashed border-gray-300" style={{ left: CHART_PADDING_LEFT, width: 100, height: BAR_HEIGHT, top: index * (BAR_HEIGHT + BAR_GAP) + 20 }}>Enter schedule below</div>)
          ))}
          <div className="absolute bottom-0 left-0 right-0 h-10">
            {xTicks.map(day => (<div key={`tick-${day}`} className="absolute text-xs text-gray-500" style={{ left: dayToPixel(day), transform: 'translateX(-50%)', bottom: 20 }}>{day}</div>))}
            <div className="absolute text-sm font-medium text-gray-600" style={{ left: '50%', transform: 'translateX(-50%)', bottom: 2 }}>Time (days)</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== POST-SURVEY COMPONENT ====================
function PostSurvey({ onComplete, sessionId, playerName, studentId, preKnowledgeScore, preSEScore }) {
  const [step, setStep] = useState(1);
  const [knowledge, setKnowledge] = useState({});
  const [selfEfficacy, setSelfEfficacy] = useState({});
  const [experience, setExperience] = useState({});
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isKnowledgeComplete = KNOWLEDGE_QUESTIONS.every(q => knowledge[q.id]);
  const isSEComplete = SELF_EFFICACY_QUESTIONS.every(q => selfEfficacy[q.id]);
  const isEXComplete = EXPERIENCE_QUESTIONS.every(q => experience[q.id]);

  const getOptionClass = (selected, current) => {
    const base = 'block p-3 rounded-lg border-2 cursor-pointer transition-all text-left w-full';
    return selected === current ? `${base} border-green-500 bg-green-50` : `${base} border-gray-200 hover:border-green-300`;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const knowledgeScore = calculateKnowledgeScore(knowledge);
    const seScore = calculateMeanScore(selfEfficacy, SELF_EFFICACY_QUESTIONS);
    const exScore = calculateMeanScore(experience, EXPERIENCE_QUESTIONS);
    const knowledgeGain = knowledgeScore - preKnowledgeScore;
    const seGain = (parseFloat(seScore) - parseFloat(preSEScore)).toFixed(2);
    const data = { sessionId, timestamp: new Date().toISOString(), studentId, knowledge, knowledgeScore, knowledgeGain, selfEfficacy, seScore, seGain, experience, exScore, comments };
    await submitToGoogleSheets('post-survey', data);
    onComplete({ knowledge, knowledgeScore, knowledgeGain, selfEfficacy, seScore, seGain, experience, exScore, comments });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-600 p-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center text-white mb-6">
          <h1 className="text-3xl font-bold">Post-Game Survey</h1>
          <p className="text-green-200">Almost done, {playerName}! Just a few more questions.</p>
        </div>

        <div className="bg-white rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between text-sm">
            {[{ n: 1, t: 'Knowledge' }, { n: 2, t: 'Confidence' }, { n: 3, t: 'Experience' }].map((s, i) => (
              <React.Fragment key={s.n}>
                <div className={`flex items-center gap-2 ${step >= s.n ? 'text-green-600 font-bold' : 'text-gray-400'}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= s.n ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>{s.n}</span>
                  {s.t}
                </div>
                {i < 2 && <div className="flex-1 h-1 mx-2 bg-gray-200"><div className={`h-full bg-green-600 transition-all ${step > s.n ? 'w-full' : 'w-0'}`} /></div>}
              </React.Fragment>
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="bg-white rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-green-900 border-b pb-2">Section 1: Knowledge Assessment</h2>
            <p className="text-sm text-gray-600">Same questions as before - let us see what you learned!</p>
            {KNOWLEDGE_QUESTIONS.map((q, idx) => (
              <div key={q.id} className="border rounded-lg p-4">
                <h3 className="font-bold mb-3">{idx + 1}. {q.question}</h3>
                <div className="space-y-2">
                  {q.options.map(opt => (
                    <label key={opt.value} className={getOptionClass(knowledge[q.id], opt.value)}>
                      <input type="radio" name={`post-${q.id}`} value={opt.value} checked={knowledge[q.id] === opt.value} onChange={e => setKnowledge({ ...knowledge, [q.id]: e.target.value })} className="mr-2" />
                      <span className="font-medium">{opt.value.toUpperCase()})</span> {opt.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={() => setStep(2)} disabled={!isKnowledgeComplete} className={`w-full py-3 rounded-lg font-bold ${isKnowledgeComplete ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>Continue</button>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-green-900 border-b pb-2">Section 2: Confidence Level</h2>
            <p className="text-sm text-gray-600">Rate your confidence NOW after playing the game (1 = Not confident, 5 = Very confident)</p>
            {SELF_EFFICACY_QUESTIONS.map((q, idx) => (
              <div key={q.id} className="border rounded-lg p-4">
                <h3 className="font-medium mb-3">{idx + 1}. {q.question}</h3>
                <div className="flex justify-between gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <label key={n} className={`flex-1 flex flex-col items-center cursor-pointer p-3 rounded-lg border-2 ${selfEfficacy[q.id] === n ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'}`}>
                      <input type="radio" className="sr-only" checked={selfEfficacy[q.id] === n} onChange={() => setSelfEfficacy({ ...selfEfficacy, [q.id]: n })} />
                      <span className={`text-2xl font-bold ${selfEfficacy[q.id] === n ? 'text-green-600' : 'text-gray-400'}`}>{n}</span>
                      <span className="text-xs text-gray-500 mt-1">{n === 1 ? 'Low' : n === 5 ? 'High' : ''}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-lg font-bold border-2 hover:bg-gray-50">Back</button>
              <button onClick={() => setStep(3)} disabled={!isSEComplete} className={`flex-1 py-3 rounded-lg font-bold ${isSEComplete ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>Continue</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="bg-white rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-green-900 border-b pb-2">Section 3: Game Experience</h2>
            <p className="text-sm text-gray-600">Rate your experience with the game (1 = Strongly Disagree, 5 = Strongly Agree)</p>
            {EXPERIENCE_QUESTIONS.map((q, idx) => (
              <div key={q.id} className="border rounded-lg p-4">
                <h3 className="font-medium mb-3">{idx + 1}. {q.question}</h3>
                <div className="flex justify-between gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <label key={n} className={`flex-1 flex flex-col items-center cursor-pointer p-3 rounded-lg border-2 ${experience[q.id] === n ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'}`}>
                      <input type="radio" className="sr-only" checked={experience[q.id] === n} onChange={() => setExperience({ ...experience, [q.id]: n })} />
                      <span className={`text-2xl font-bold ${experience[q.id] === n ? 'text-green-600' : 'text-gray-400'}`}>{n}</span>
                      <span className="text-xs text-gray-500 mt-1">{n === 1 ? 'Disagree' : n === 5 ? 'Agree' : ''}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium mb-1">Any additional comments or feedback? (Optional)</label>
              <textarea value={comments} onChange={e => setComments(e.target.value)} className="w-full px-3 py-2 border-2 rounded-lg" rows={4} placeholder="What did you like? What could be improved?" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-lg font-bold border-2 hover:bg-gray-50">Back</button>
              <button onClick={handleSubmit} disabled={!isEXComplete || submitting} className={`flex-1 py-3 rounded-lg font-bold ${isEXComplete && !submitting ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>{submitting ? 'Submitting...' : 'Complete Survey'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== THANK YOU COMPONENT ====================
function ThankYou() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-purple-700 p-4 flex items-center justify-center">
      <div className="max-w-xl w-full bg-white rounded-xl p-8 text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-3xl font-bold text-purple-900 mb-2">Thank You!</h1>
        <p className="text-gray-600 mb-6">You have completed the LOB Simulation Game and all surveys.</p>
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-6">
          <div className="text-green-700 font-bold text-lg">Your responses have been recorded</div>
          <p className="text-green-600 text-sm mt-1">Thank you for participating in this research study!</p>
        </div>
        <button onClick={() => window.location.reload()} className="px-8 py-3 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700">Play Again</button>
      </div>
    </div>
  );
}


// ==================== ROUND 1 COMPONENT ====================
function Round1({ onComplete }) {
  const [durInput, setDurInput] = useState({ exc: '', pipe: '', back: '' });
  const [durValidated, setDurValidated] = useState(false);
  const [scheduleInput, setScheduleInput] = useState({ excS: '', pipeS: '', backS: '' });

  const durations = useMemo(() => ({ exc: parseInt(durInput.exc) || 0, pipe: parseInt(durInput.pipe) || 0, back: parseInt(durInput.back) || 0 }), [durInput]);
  const durCorrect = { exc: durations.exc === CORRECT_DURATIONS.exc, pipe: durations.pipe === CORRECT_DURATIONS.pipe, back: durations.back === CORRECT_DURATIONS.back };
  const allDurationsCorrect = durCorrect.exc && durCorrect.pipe && durCorrect.back;

  const fullSchedule = useMemo(() => {
    const excS = parseInt(scheduleInput.excS) || 0, pipeS = parseInt(scheduleInput.pipeS) || 0, backS = parseInt(scheduleInput.backS) || 0;
    const excE = excS > 0 ? excS + CORRECT_DURATIONS.exc - 1 : 0;
    const pipeE = pipeS > 0 ? pipeS + CORRECT_DURATIONS.pipe - 1 : 0;
    const backE = backS > 0 ? backS + CORRECT_DURATIONS.back - 1 : 0;
    return { excS, excE, pipeS, pipeE, backS, backE, end: Math.max(excE, pipeE, backE, MOB_DAYS) };
  }, [scheduleInput]);

  const handleBarDrag = useCallback((newSchedule) => {
    if (newSchedule.excStart > 0) setScheduleInput(prev => ({ ...prev, excS: String(newSchedule.excStart) }));
    if (newSchedule.pipeStart > 0) setScheduleInput(prev => ({ ...prev, pipeS: String(newSchedule.pipeStart) }));
    if (newSchedule.backStart > 0) setScheduleInput(prev => ({ ...prev, backS: String(newSchedule.backStart) }));
  }, []);

  const allScheduleFilled = fullSchedule.excS > 0 && fullSchedule.pipeS > 0 && fullSchedule.backS > 0;

  const DurationInputCell = ({ value, onChange, isCorrect, submitted }) => {
    let className = "w-20 px-2 py-1 border-2 rounded text-center font-bold ";
    if (!submitted) className += "bg-yellow-50 border-yellow-400";
    else if (isCorrect) className += "bg-green-100 border-green-500 text-green-700";
    else className += "bg-red-100 border-red-500 text-red-700";
    return <input type="number" value={value} onChange={onChange} disabled={submitted && isCorrect} className={className} placeholder="?" />;
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <h3 className="font-bold text-xl text-blue-900">📋 Round 1: Create Your Schedule</h3>
        <p className="text-gray-600 mt-1">First calculate durations, then input start days to build your schedule.</p>
      </div>

      <div className="bg-white rounded-lg shadow p-5">
        <h4 className="font-bold text-gray-700 mb-4">📐 Activity Sequence & Duration Calculation</h4>
        <div className="flex justify-center items-center gap-4 text-center mb-6">
          <div className="flex flex-col items-center"><span className="text-3xl">⛏️</span><span className="font-medium text-sm">Excavation</span></div>
          <span className="text-2xl text-gray-400">→</span>
          <div className="flex flex-col items-center"><span className="text-3xl">🔧</span><span className="font-medium text-sm">Pipe Laying</span></div>
          <span className="text-2xl text-gray-400">→</span>
          <div className="flex flex-col items-center"><span className="text-3xl">🚜</span><span className="font-medium text-sm">Backfill</span></div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4"><div className="font-bold text-yellow-800">Formula: Duration = ROUNDUP(Project Length ÷ Rate)</div></div>
        <p className="text-sm text-gray-600 mb-3">Calculate duration for each activity (Project Length = {PROJECT_LENGTH.toLocaleString()} ft):</p>
        <table className="w-full text-sm border">
          <thead className="bg-gray-100"><tr><th className="px-2 py-2 border text-left">Activity</th><th className="px-2 py-2 border text-center">Rate (ft/day)</th><th className="px-2 py-2 border text-center bg-yellow-50">Duration (days)</th></tr></thead>
          <tbody>
            <tr className="text-blue-700"><td className="px-2 py-2 border">Excavation & Bedding</td><td className="px-2 py-2 border text-center">{CREWS.exc.rate}</td><td className="px-2 py-2 border text-center"><DurationInputCell value={durInput.exc} onChange={(e) => setDurInput({ ...durInput, exc: e.target.value })} isCorrect={durCorrect.exc} submitted={durValidated} /></td></tr>
            <tr className="text-green-700"><td className="px-2 py-2 border">Pipe Laying & Alignment</td><td className="px-2 py-2 border text-center">{CREWS.pipe.rate}</td><td className="px-2 py-2 border text-center"><DurationInputCell value={durInput.pipe} onChange={(e) => setDurInput({ ...durInput, pipe: e.target.value })} isCorrect={durCorrect.pipe} submitted={durValidated} /></td></tr>
            <tr className="text-orange-700"><td className="px-2 py-2 border">Backfill & Compaction</td><td className="px-2 py-2 border text-center">{CREWS.back.rate}</td><td className="px-2 py-2 border text-center"><DurationInputCell value={durInput.back} onChange={(e) => setDurInput({ ...durInput, back: e.target.value })} isCorrect={durCorrect.back} submitted={durValidated} /></td></tr>
          </tbody>
        </table>
        <div className="mt-4">
          <button onClick={() => setDurValidated(true)} className="px-4 py-2 bg-blue-500 text-white rounded font-bold hover:bg-blue-600">Check Answers</button>
          {durValidated && !allDurationsCorrect && <div className="mt-2 p-2 bg-red-100 text-red-700 rounded">❌ Some durations are incorrect.</div>}
          {durValidated && allDurationsCorrect && <div className="mt-2 p-2 bg-green-100 text-green-700 rounded">✅ All durations correct! Build your schedule below.</div>}
        </div>
      </div>

      {durValidated && allDurationsCorrect && (
        <div className="bg-white rounded-lg shadow p-5">
          <h4 className="font-bold text-gray-700 mb-4">📝 Build Your Schedule</h4>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4"><div className="font-bold text-yellow-800">Formula: End = Start + Duration - 1</div></div>
          <table className="w-full text-sm border">
            <thead className="bg-gray-100"><tr><th className="px-2 py-2 border text-left">Activity</th><th className="px-2 py-2 border text-center">Duration</th><th className="px-2 py-2 border text-center bg-yellow-50">Start</th><th className="px-2 py-2 border text-center">End</th></tr></thead>
            <tbody>
              <tr className="bg-gray-50"><td className="px-2 py-2 border">Mobilization</td><td className="px-2 py-2 border text-center">{MOB_DAYS}</td><td className="px-2 py-2 border text-center">1</td><td className="px-2 py-2 border text-center">{MOB_DAYS}</td></tr>
              <tr className="text-blue-700"><td className="px-2 py-2 border">Excavation</td><td className="px-2 py-2 border text-center">{CORRECT_DURATIONS.exc}</td><td className="px-2 py-2 border text-center"><input type="number" value={scheduleInput.excS} onChange={(e) => setScheduleInput({ ...scheduleInput, excS: e.target.value })} className="w-16 px-1 py-1 border-2 rounded text-center bg-yellow-50 border-yellow-400" placeholder="?" /></td><td className="px-2 py-2 border text-center font-bold">{fullSchedule.excE > 0 ? fullSchedule.excE : '-'}</td></tr>
              <tr className="text-green-700"><td className="px-2 py-2 border">Pipe Laying</td><td className="px-2 py-2 border text-center">{CORRECT_DURATIONS.pipe}</td><td className="px-2 py-2 border text-center"><input type="number" value={scheduleInput.pipeS} onChange={(e) => setScheduleInput({ ...scheduleInput, pipeS: e.target.value })} className="w-16 px-1 py-1 border-2 rounded text-center bg-yellow-50 border-yellow-400" placeholder="?" /></td><td className="px-2 py-2 border text-center font-bold">{fullSchedule.pipeE > 0 ? fullSchedule.pipeE : '-'}</td></tr>
              <tr className="text-orange-700"><td className="px-2 py-2 border">Backfill</td><td className="px-2 py-2 border text-center">{CORRECT_DURATIONS.back}</td><td className="px-2 py-2 border text-center"><input type="number" value={scheduleInput.backS} onChange={(e) => setScheduleInput({ ...scheduleInput, backS: e.target.value })} className="w-16 px-1 py-1 border-2 rounded text-center bg-yellow-50 border-yellow-400" placeholder="?" /></td><td className="px-2 py-2 border text-center font-bold">{fullSchedule.backE > 0 ? fullSchedule.backE : '-'}</td></tr>
            </tbody>
          </table>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg text-center"><span className="text-gray-600">Project Duration:</span><span className="ml-3 text-2xl font-bold text-blue-600">{allScheduleFilled ? `${fullSchedule.end} days` : '- days'}</span></div>
        </div>
      )}

      {durValidated && allDurationsCorrect && (
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex justify-between items-center mb-4">
            <div><h4 className="font-bold text-gray-700">📊 Bar Chart Schedule</h4><p className="text-sm text-gray-500">Drag bars to adjust start times</p></div>
            <button onClick={() => setScheduleInput({ excS: '', pipeS: '', backS: '' })} className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300">🔄 Reset</button>
          </div>
          <DraggableBarChart schedule={{ excStart: fullSchedule.excS, pipeStart: fullSchedule.pipeS, backStart: fullSchedule.backS }} durations={CORRECT_DURATIONS} onScheduleChange={handleBarDrag} />
        </div>
      )}

      <button onClick={() => onComplete(fullSchedule)} disabled={!allScheduleFilled || !allDurationsCorrect} className="w-full py-4 bg-blue-600 text-white rounded-lg font-bold text-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed">
        {!durValidated || !allDurationsCorrect ? 'Complete Duration Calculation First' : !allScheduleFilled ? 'Fill in Schedule to Continue' : 'Complete R1 →'}
      </button>
    </div>
  );
}

// ==================== DRAGGABLE BAR CHART ====================
function DraggableBarChart({ schedule, durations, onScheduleChange }) {
  const chartRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);

  const CHART_WIDTH = 700, CHART_PADDING_LEFT = 180, MAX_DAY = 160;
  const USABLE_WIDTH = CHART_WIDTH - CHART_PADDING_LEFT - 20;
  const PIXELS_PER_DAY = USABLE_WIDTH / MAX_DAY;
  const BAR_HEIGHT = 36, BAR_GAP = 12;
  const CHART_HEIGHT = 4 * (BAR_HEIGHT + BAR_GAP) + 60;

  const dayToPixel = (day) => CHART_PADDING_LEFT + day * PIXELS_PER_DAY;
  const pixelToDay = (pixel) => Math.max(1, Math.min(Math.round((pixel - CHART_PADDING_LEFT) / PIXELS_PER_DAY), MAX_DAY - 20));

  const handleDragStart = (barType, clientX) => {
    const rect = chartRef.current.getBoundingClientRect();
    const posX = clientX - rect.left;
    let currentStart = barType === 'exc' ? schedule.excStart : barType === 'pipe' ? schedule.pipeStart : schedule.backStart;
    if (!currentStart || currentStart < 1) currentStart = 1;
    setDragOffset(posX - dayToPixel(currentStart));
    setDragging(barType);
  };

  const handleMouseDown = (barType, e) => { e.preventDefault(); handleDragStart(barType, e.clientX); };
  const handleTouchStart = (barType, e) => { e.preventDefault(); handleDragStart(barType, e.touches[0].clientX); };

  const handleDragMove = useCallback((clientX) => {
    if (!dragging || !chartRef.current) return;
    const rect = chartRef.current.getBoundingClientRect();
    const newDay = pixelToDay(clientX - rect.left - dragOffset);
    if (dragging === 'exc') onScheduleChange({ ...schedule, excStart: newDay });
    else if (dragging === 'pipe') onScheduleChange({ ...schedule, pipeStart: newDay });
    else if (dragging === 'back') onScheduleChange({ ...schedule, backStart: newDay });
  }, [dragging, dragOffset, schedule, onScheduleChange]);

  const handleMouseMove = useCallback((e) => handleDragMove(e.clientX), [handleDragMove]);
  const handleTouchMove = useCallback((e) => { e.preventDefault(); handleDragMove(e.touches[0].clientX); }, [handleDragMove]);
  const handleDragEnd = useCallback(() => setDragging(null), []);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleDragEnd);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [dragging, handleMouseMove, handleTouchMove, handleDragEnd]);

  const bars = [
    { id: 'mob', label: 'Mobilization', start: 1, duration: MOB_DAYS, color: 'bg-gray-400', locked: true, show: true },
    { id: 'exc', label: 'Excavation & Bedding', start: schedule.excStart || 0, duration: durations.exc, color: 'bg-blue-500', locked: false, show: durations.exc > 0 && schedule.excStart > 0 },
    { id: 'pipe', label: 'Pipe Laying & Alignment', start: schedule.pipeStart || 0, duration: durations.pipe, color: 'bg-green-500', locked: false, show: durations.pipe > 0 && schedule.pipeStart > 0 },
    { id: 'back', label: 'Backfill & Compaction', start: schedule.backStart || 0, duration: durations.back, color: 'bg-orange-500', locked: false, show: durations.back > 0 && schedule.backStart > 0 },
  ];

  const xTicks = [0, 20, 40, 60, 80, 100, 120, 140, 160];

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-4 mb-4 text-sm justify-center">
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-400 rounded"></div><span>Mobilization</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-blue-500 rounded"></div><span>Excavation</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-green-500 rounded"></div><span>Pipe Laying</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-orange-500 rounded"></div><span>Backfill</span></div>
      </div>
      <div className="overflow-x-auto pb-2">
        <div ref={chartRef} className="relative bg-gray-50 rounded-lg border" style={{ width: CHART_WIDTH, height: CHART_HEIGHT, margin: '0 auto', minWidth: CHART_WIDTH, touchAction: 'pan-x' }}>
          {xTicks.map(day => (<div key={`grid-${day}`} className="absolute w-px bg-gray-200" style={{ left: dayToPixel(day), top: 10, bottom: 40 }} />))}
          {bars.map((bar, index) => (<div key={`label-${bar.id}`} className="absolute text-sm text-gray-700 text-right pr-3" style={{ left: 20, width: CHART_PADDING_LEFT - 30, top: index * (BAR_HEIGHT + BAR_GAP) + 20 + BAR_HEIGHT / 2 - 10 }}>{bar.label}</div>))}
          {bars.map((bar, index) => (
            bar.show ? (
              <div key={bar.id} className={`absolute ${bar.color} rounded flex items-center justify-center text-white text-xs font-bold shadow ${bar.locked ? 'cursor-not-allowed opacity-80' : 'cursor-grab active:cursor-grabbing hover:shadow-lg'} ${dragging === bar.id ? 'ring-4 ring-yellow-400 shadow-xl z-10' : ''}`}
                style={{ left: dayToPixel(bar.start), width: Math.max(bar.duration * PIXELS_PER_DAY, 40), height: BAR_HEIGHT, top: index * (BAR_HEIGHT + BAR_GAP) + 20, touchAction: 'none' }}
                onMouseDown={bar.locked ? undefined : (e) => handleMouseDown(bar.id, e)} onTouchStart={bar.locked ? undefined : (e) => handleTouchStart(bar.id, e)}>
                {bar.locked && <span className="mr-1">🔒</span>}{bar.start} - {bar.start + bar.duration - 1}
              </div>
            ) : (
              <div key={bar.id} className="absolute bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs border-2 border-dashed border-gray-300" style={{ left: CHART_PADDING_LEFT, width: 100, height: BAR_HEIGHT, top: index * (BAR_HEIGHT + BAR_GAP) + 20 }}>Enter schedule below</div>
            )
          ))}
          <div className="absolute bottom-0 left-0 right-0 h-10">
            {xTicks.map(day => (<div key={`tick-${day}`} className="absolute text-xs text-gray-500" style={{ left: dayToPixel(day), transform: 'translateX(-50%)', bottom: 20 }}>{day}</div>))}
            <div className="absolute text-sm font-medium text-gray-600" style={{ left: '50%', transform: 'translateX(-50%)', bottom: 2 }}>Time (days)</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== ROUND 1 COMPONENT ====================
function Round1({ onComplete }) {
  const [durInput, setDurInput] = useState({ exc: '', pipe: '', back: '' });
  const [durValidated, setDurValidated] = useState(false);
  const [scheduleInput, setScheduleInput] = useState({ excS: '', pipeS: '', backS: '' });

  const durations = useMemo(() => ({ exc: parseInt(durInput.exc) || 0, pipe: parseInt(durInput.pipe) || 0, back: parseInt(durInput.back) || 0 }), [durInput]);
  const durCorrect = { exc: durations.exc === CORRECT_DURATIONS.exc, pipe: durations.pipe === CORRECT_DURATIONS.pipe, back: durations.back === CORRECT_DURATIONS.back };
  const allDurationsCorrect = durCorrect.exc && durCorrect.pipe && durCorrect.back;

  const fullSchedule = useMemo(() => {
    const excS = parseInt(scheduleInput.excS) || 0, pipeS = parseInt(scheduleInput.pipeS) || 0, backS = parseInt(scheduleInput.backS) || 0;
    const excE = excS > 0 ? excS + CORRECT_DURATIONS.exc - 1 : 0;
    const pipeE = pipeS > 0 ? pipeS + CORRECT_DURATIONS.pipe - 1 : 0;
    const backE = backS > 0 ? backS + CORRECT_DURATIONS.back - 1 : 0;
    return { excS, excE, pipeS, pipeE, backS, backE, end: Math.max(excE, pipeE, backE, MOB_DAYS) };
  }, [scheduleInput]);

  const handleBarDrag = useCallback((newSchedule) => {
    if (newSchedule.excStart > 0) setScheduleInput(prev => ({ ...prev, excS: String(newSchedule.excStart) }));
    if (newSchedule.pipeStart > 0) setScheduleInput(prev => ({ ...prev, pipeS: String(newSchedule.pipeStart) }));
    if (newSchedule.backStart > 0) setScheduleInput(prev => ({ ...prev, backS: String(newSchedule.backStart) }));
  }, []);

  const allScheduleFilled = fullSchedule.excS > 0 && fullSchedule.pipeS > 0 && fullSchedule.backS > 0;

  const DurationInputCell = ({ value, onChange, isCorrect, submitted }) => {
    let className = "w-20 px-2 py-1 border-2 rounded text-center font-bold ";
    if (!submitted) className += "bg-yellow-50 border-yellow-400";
    else if (isCorrect) className += "bg-green-100 border-green-500 text-green-700";
    else className += "bg-red-100 border-red-500 text-red-700";
    return <input type="number" value={value} onChange={onChange} disabled={submitted && isCorrect} className={className} placeholder="?" />;
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <h3 className="font-bold text-xl text-blue-900">Round 1: Create Your Schedule</h3>
        <p className="text-gray-600 mt-1">First calculate each activity duration, then input start days to build your schedule.</p>
      </div>

      <div className="bg-white rounded-lg shadow p-5">
        <h4 className="font-bold text-gray-700 mb-4">Activity Sequence and Duration Calculation</h4>
        <div className="flex justify-center items-center gap-4 text-center mb-6">
          <div className="flex flex-col items-center"><span className="text-3xl">⛏️</span><span className="font-medium text-sm">Excavation</span></div>
          <span className="text-2xl text-gray-400">→</span>
          <div className="flex flex-col items-center"><span className="text-3xl">🔧</span><span className="font-medium text-sm">Pipe Laying</span></div>
          <span className="text-2xl text-gray-400">→</span>
          <div className="flex flex-col items-center"><span className="text-3xl">🚜</span><span className="font-medium text-sm">Backfill</span></div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <div className="font-bold text-yellow-800 mb-2">Formula: Duration = ROUNDUP(Project Length / Rate)</div>
          <div className="text-sm text-yellow-700">Project Length = {PROJECT_LENGTH.toLocaleString()} ft</div>
        </div>
        <table className="w-full text-sm border">
          <thead className="bg-gray-100"><tr><th className="px-2 py-2 border text-left">Activity</th><th className="px-2 py-2 border text-center">Rate (ft/day)</th><th className="px-2 py-2 border text-center bg-yellow-50">Duration (days)</th></tr></thead>
          <tbody>
            <tr className="text-blue-700"><td className="px-2 py-2 border">Excavation & Bedding</td><td className="px-2 py-2 border text-center">{CREWS.exc.rate}</td><td className="px-2 py-2 border text-center"><DurationInputCell value={durInput.exc} onChange={(e) => setDurInput({ ...durInput, exc: e.target.value })} isCorrect={durCorrect.exc} submitted={durValidated} /></td></tr>
            <tr className="text-green-700"><td className="px-2 py-2 border">Pipe Laying & Alignment</td><td className="px-2 py-2 border text-center">{CREWS.pipe.rate}</td><td className="px-2 py-2 border text-center"><DurationInputCell value={durInput.pipe} onChange={(e) => setDurInput({ ...durInput, pipe: e.target.value })} isCorrect={durCorrect.pipe} submitted={durValidated} /></td></tr>
            <tr className="text-orange-700"><td className="px-2 py-2 border">Backfill & Compaction</td><td className="px-2 py-2 border text-center">{CREWS.back.rate}</td><td className="px-2 py-2 border text-center"><DurationInputCell value={durInput.back} onChange={(e) => setDurInput({ ...durInput, back: e.target.value })} isCorrect={durCorrect.back} submitted={durValidated} /></td></tr>
          </tbody>
        </table>
        <div className="mt-4">
          <button onClick={() => setDurValidated(true)} className="px-4 py-2 bg-blue-500 text-white rounded font-bold hover:bg-blue-600">Check Answers</button>
          {durValidated && !allDurationsCorrect && <div className="mt-2 p-2 bg-red-100 text-red-700 rounded">Some durations are incorrect. Please fix them.</div>}
          {durValidated && allDurationsCorrect && <div className="mt-2 p-2 bg-green-100 text-green-700 rounded">All durations are correct! Now build your schedule below.</div>}
        </div>
      </div>

      {durValidated && allDurationsCorrect && (
        <>
          <div className="bg-white rounded-lg shadow p-5">
            <h4 className="font-bold text-gray-700 mb-4">Build Your Schedule</h4>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="font-bold text-yellow-800">Formula: End = Start + Duration - 1</div>
            </div>
            <table className="w-full text-sm border">
              <thead className="bg-gray-100"><tr><th className="px-2 py-2 border text-left">Activity</th><th className="px-2 py-2 border text-center">Duration</th><th className="px-2 py-2 border text-center bg-yellow-50">Start</th><th className="px-2 py-2 border text-center">End</th></tr></thead>
              <tbody>
                <tr className="bg-gray-50"><td className="px-2 py-2 border">Mobilization</td><td className="px-2 py-2 border text-center">{MOB_DAYS}</td><td className="px-2 py-2 border text-center">1</td><td className="px-2 py-2 border text-center">{MOB_DAYS}</td></tr>
                <tr className="text-blue-700"><td className="px-2 py-2 border">Excavation</td><td className="px-2 py-2 border text-center">{CORRECT_DURATIONS.exc}</td><td className="px-2 py-2 border text-center"><input type="number" value={scheduleInput.excS} onChange={(e) => setScheduleInput({ ...scheduleInput, excS: e.target.value })} className="w-16 px-1 py-1 border-2 rounded text-center bg-yellow-50 border-yellow-400" placeholder="?" /></td><td className="px-2 py-2 border text-center font-bold">{fullSchedule.excE > 0 ? fullSchedule.excE : '-'}</td></tr>
                <tr className="text-green-700"><td className="px-2 py-2 border">Pipe Laying</td><td className="px-2 py-2 border text-center">{CORRECT_DURATIONS.pipe}</td><td className="px-2 py-2 border text-center"><input type="number" value={scheduleInput.pipeS} onChange={(e) => setScheduleInput({ ...scheduleInput, pipeS: e.target.value })} className="w-16 px-1 py-1 border-2 rounded text-center bg-yellow-50 border-yellow-400" placeholder="?" /></td><td className="px-2 py-2 border text-center font-bold">{fullSchedule.pipeE > 0 ? fullSchedule.pipeE : '-'}</td></tr>
                <tr className="text-orange-700"><td className="px-2 py-2 border">Backfill</td><td className="px-2 py-2 border text-center">{CORRECT_DURATIONS.back}</td><td className="px-2 py-2 border text-center"><input type="number" value={scheduleInput.backS} onChange={(e) => setScheduleInput({ ...scheduleInput, backS: e.target.value })} className="w-16 px-1 py-1 border-2 rounded text-center bg-yellow-50 border-yellow-400" placeholder="?" /></td><td className="px-2 py-2 border text-center font-bold">{fullSchedule.backE > 0 ? fullSchedule.backE : '-'}</td></tr>
              </tbody>
            </table>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-center">
              <span className="text-gray-600">Project Duration:</span>
              <span className="ml-3 text-2xl font-bold text-blue-600">{allScheduleFilled ? `${fullSchedule.end} days` : '- days'}</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex justify-between items-center mb-4">
              <div><h4 className="font-bold text-gray-700">Bar Chart Schedule</h4><p className="text-sm text-gray-500">Generated from your schedule. You can also drag the bars.</p></div>
              <button onClick={() => setScheduleInput({ excS: '', pipeS: '', backS: '' })} className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300">Reset</button>
            </div>
            <DraggableBarChart schedule={{ excStart: fullSchedule.excS, pipeStart: fullSchedule.pipeS, backStart: fullSchedule.backS }} durations={CORRECT_DURATIONS} onScheduleChange={handleBarDrag} />
          </div>
        </>
      )}

      <button onClick={() => onComplete(fullSchedule)} disabled={!allScheduleFilled || !allDurationsCorrect} className="w-full py-4 bg-blue-600 text-white rounded-lg font-bold text-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed">
        {!durValidated || !allDurationsCorrect ? 'Complete Duration Calculation First' : !allScheduleFilled ? 'Fill in Schedule to Continue' : 'Complete R1'}
      </button>
    </div>
  );
}


// ==================== SIMPLE LOB CHART FOR R1 DISPLAY ====================
function SimpleLOBChart({ schedule }) {
  const CHART_WIDTH = 500, CHART_HEIGHT = 220;
  const PADDING = { top: 20, right: 25, bottom: 45, left: 55 };
  const PLOT_WIDTH = CHART_WIDTH - PADDING.left - PADDING.right;
  const PLOT_HEIGHT = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const MAX_DAY = Math.max(schedule.excE || 0, schedule.pipeE || 0, schedule.backE || 0, 100) + 10;

  const dayToX = (day) => PADDING.left + (day / MAX_DAY) * PLOT_WIDTH;
  const distToY = (dist) => PADDING.top + PLOT_HEIGHT - (dist / PROJECT_LENGTH) * PLOT_HEIGHT;

  const getLinePoints = (start, end) => {
    if (!start || !end || start <= 0) return '';
    return `${dayToX(start)},${distToY(0)} ${dayToX(end)},${distToY(PROJECT_LENGTH)}`;
  };

  const lines = [
    { id: 'exc', start: schedule.excS, end: schedule.excE, color: '#2563eb', name: 'Excavation' },
    { id: 'pipe', start: schedule.pipeS, end: schedule.pipeE, color: '#16a34a', name: 'Pipe Laying' },
    { id: 'back', start: schedule.backS, end: schedule.backE, color: '#ea580c', name: 'Backfill' },
  ];

  const conflicts = findConflicts(schedule, CORRECT_DURATIONS);
  const xTicks = []; for (let d = 0; d <= MAX_DAY; d += 20) xTicks.push(d);
  const yTicks = [0, 4000, 8000, 12000, 16000];

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-1 text-xs justify-center">{lines.map(l => (<div key={l.id} className="flex items-center gap-1"><div className="w-4 h-0.5 rounded" style={{ backgroundColor: l.color }}></div><span style={{ color: l.color }}>{l.name}</span></div>))}</div>
      <svg width="100%" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="bg-white">
        {xTicks.map(day => (<line key={`gx-${day}`} x1={dayToX(day)} y1={PADDING.top} x2={dayToX(day)} y2={CHART_HEIGHT - PADDING.bottom} stroke="#f0f0f0" strokeWidth="1" />))}
        {yTicks.map(dist => (<line key={`gy-${dist}`} x1={PADDING.left} y1={distToY(dist)} x2={CHART_WIDTH - PADDING.right} y2={distToY(dist)} stroke="#f0f0f0" strokeWidth="1" />))}
        <line x1={PADDING.left} y1={CHART_HEIGHT - PADDING.bottom} x2={CHART_WIDTH - PADDING.right} y2={CHART_HEIGHT - PADDING.bottom} stroke="#374151" strokeWidth="1.5" />
        <line x1={PADDING.left} y1={PADDING.top} x2={PADDING.left} y2={CHART_HEIGHT - PADDING.bottom} stroke="#374151" strokeWidth="1.5" />
        {xTicks.map(day => (<text key={`tx-${day}`} x={dayToX(day)} y={CHART_HEIGHT - PADDING.bottom + 16} textAnchor="middle" fontSize="10" fill="#6b7280">{day}</text>))}
        <text x={CHART_WIDTH / 2} y={CHART_HEIGHT - 5} textAnchor="middle" fontSize="11" fill="#374151">Time (days)</text>
        {yTicks.map(dist => (<text key={`ty-${dist}`} x={PADDING.left - 8} y={distToY(dist) + 3} textAnchor="end" fontSize="10" fill="#6b7280">{(dist / 1000)}k</text>))}
        <text x={12} y={CHART_HEIGHT / 2} textAnchor="middle" transform={`rotate(-90, 12, ${CHART_HEIGHT / 2})`} fontSize="11" fill="#374151">Distance (ft)</text>
        {lines.map(l => (<polyline key={l.id} points={getLinePoints(l.start, l.end)} fill="none" stroke={l.color} strokeWidth="2.5" />))}
        {conflicts.map((c, i) => (<g key={`c-${i}`}><circle cx={dayToX(c.day)} cy={distToY(c.dist)} r="6" fill="#ef4444" /><text x={dayToX(c.day)} y={distToY(c.dist) + 3.5} textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">✕</text></g>))}
      </svg>
      <div className="mt-2 text-center">
        {conflicts.length > 0 ? (<span className="inline-block px-2 py-1 bg-red-100 text-red-700 text-xs rounded font-medium">❌ {conflicts.length} conflict(s) detected!</span>) : (<span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs rounded font-medium">✅ No conflicts</span>)}
      </div>
    </div>
  );
}

// ==================== DRAGGABLE LOB CHART FOR R2 ====================
function DraggableLOBChart({ r1Schedule, r2Schedule, onR2Change, durations }) {
  const chartRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);

  const CHART_WIDTH = 600, CHART_HEIGHT = 350;
  const PADDING = { top: 40, right: 30, bottom: 50, left: 60 };
  const PLOT_WIDTH = CHART_WIDTH - PADDING.left - PADDING.right;
  const PLOT_HEIGHT = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const MAX_DAY = 150;

  const dayToX = (day) => PADDING.left + (day / MAX_DAY) * PLOT_WIDTH;
  const xToDay = (x) => Math.round(((x - PADDING.left) / PLOT_WIDTH) * MAX_DAY);
  const distToY = (dist) => PADDING.top + PLOT_HEIGHT - (dist / PROJECT_LENGTH) * PLOT_HEIGHT;

  const getLinePoints = (start, end) => (!start || !end || start <= 0) ? '' : `${dayToX(start)},${distToY(0)} ${dayToX(end)},${distToY(PROJECT_LENGTH)}`;

  const handleDragStart = (activity, clientX) => {
    const rect = chartRef.current.getBoundingClientRect();
    const currentStart = r2Schedule[activity + 'S'];
    setDragOffset(clientX - rect.left - dayToX(currentStart));
    setDragging(activity);
  };

  const handleMouseDown = (activity, e) => { e.preventDefault(); e.stopPropagation(); handleDragStart(activity, e.clientX); };

  const handleDragMove = useCallback((clientX) => {
    if (!dragging || !chartRef.current) return;
    const rect = chartRef.current.getBoundingClientRect();
    const newStart = Math.max(MOB_DAYS + 1, Math.min(xToDay(clientX - rect.left - dragOffset), MAX_DAY - 20));
    onR2Change({ ...r2Schedule, [dragging + 'S']: newStart });
  }, [dragging, dragOffset, r2Schedule, onR2Change]);

  const handleMouseMove = useCallback((e) => handleDragMove(e.clientX), [handleDragMove]);
  const handleDragEnd = useCallback(() => setDragging(null), []);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleDragEnd);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleDragEnd); };
  }, [dragging, handleMouseMove, handleDragEnd]);

  const r2Lines = {
    exc: { start: r2Schedule.excS, end: r2Schedule.excS + durations.exc - 1 },
    pipe: { start: r2Schedule.pipeS, end: r2Schedule.pipeS + durations.pipe - 1 },
    back: { start: r2Schedule.backS, end: r2Schedule.backS + durations.back - 1 }
  };

  const colors = { exc: '#2563eb', pipe: '#16a34a', back: '#ea580c' };
  const names = { exc: 'Excavation', pipe: 'Pipe Laying', back: 'Backfill' };

  const r2Sched = { excS: r2Lines.exc.start, excE: r2Lines.exc.end, pipeS: r2Lines.pipe.start, pipeE: r2Lines.pipe.end, backS: r2Lines.back.start, backE: r2Lines.back.end };
  const r2Conflicts = findConflicts(r2Sched, durations);

  const buffer1 = r2Schedule.pipeS - r2Schedule.excS;
  const buffer2 = r2Lines.back.end - r2Lines.pipe.end;
  const buffer1Ok = buffer1 === DEFAULT_BUFFER;
  const buffer2Ok = buffer2 === DEFAULT_BUFFER;

  const xTicks = [0, 20, 40, 60, 80, 100, 120, 140];
  const yTicks = [0, 4000, 8000, 12000, 16000];

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      <div className="flex-1">
        <svg ref={chartRef} width="100%" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="bg-white border rounded">
          {xTicks.map(day => (<line key={`gx-${day}`} x1={dayToX(day)} y1={PADDING.top} x2={dayToX(day)} y2={CHART_HEIGHT - PADDING.bottom} stroke="#f3f4f6" strokeWidth="1" />))}
          {yTicks.map(dist => (<line key={`gy-${dist}`} x1={PADDING.left} y1={distToY(dist)} x2={CHART_WIDTH - PADDING.right} y2={distToY(dist)} stroke="#f3f4f6" strokeWidth="1" />))}
          <line x1={PADDING.left} y1={CHART_HEIGHT - PADDING.bottom} x2={CHART_WIDTH - PADDING.right} y2={CHART_HEIGHT - PADDING.bottom} stroke="#374151" strokeWidth="2" />
          <line x1={PADDING.left} y1={PADDING.top} x2={PADDING.left} y2={CHART_HEIGHT - PADDING.bottom} stroke="#374151" strokeWidth="2" />
          {xTicks.map(day => (<text key={`tx-${day}`} x={dayToX(day)} y={CHART_HEIGHT - PADDING.bottom + 18} textAnchor="middle" fontSize="11" fill="#6b7280">{day}</text>))}
          <text x={CHART_WIDTH / 2} y={CHART_HEIGHT - 8} textAnchor="middle" fontSize="12" fill="#374151">Time (days)</text>
          {yTicks.map(dist => (<text key={`ty-${dist}`} x={PADDING.left - 10} y={distToY(dist) + 4} textAnchor="end" fontSize="11" fill="#6b7280">{(dist / 1000)}k</text>))}
          <text x={15} y={CHART_HEIGHT / 2} textAnchor="middle" transform={`rotate(-90, 15, ${CHART_HEIGHT / 2})`} fontSize="12" fill="#374151">Distance (ft)</text>
          
          {/* R1 dashed lines */}
          {['exc', 'pipe', 'back'].map(id => (<polyline key={`r1-${id}`} points={getLinePoints(r1Schedule[id + 'S'], r1Schedule[id + 'E'])} fill="none" stroke={colors[id]} strokeWidth="2" strokeDasharray="6,4" opacity="0.4" />))}
          
          {/* R2 solid lines with drag handles */}
          {['exc', 'pipe', 'back'].map(id => (
            <g key={`r2-${id}`}>
              <polyline points={getLinePoints(r2Lines[id].start, r2Lines[id].end)} fill="none" stroke={colors[id]} strokeWidth="3" style={{ pointerEvents: 'none' }} />
              <circle cx={dayToX(r2Lines[id].start)} cy={distToY(0)} r="12" fill={colors[id]} stroke="white" strokeWidth="2" style={{ cursor: 'grab' }} onMouseDown={(e) => handleMouseDown(id, e)} />
            </g>
          ))}
          
          {/* Conflicts */}
          {r2Conflicts.map((c, i) => (<g key={`c-${i}`}><circle cx={dayToX(c.day)} cy={distToY(c.dist)} r="7" fill="#ef4444" /><text x={dayToX(c.day)} y={distToY(c.dist) + 3.5} textAnchor="middle" fontSize="9" fill="white" fontWeight="bold">✕</text></g>))}
          
          {dragging && (<text x={CHART_WIDTH / 2} y={PADDING.top - 10} textAnchor="middle" fontSize="12" fill="#d97706" fontWeight="bold">Dragging {names[dragging]}...</text>)}
        </svg>
        
        <div className="flex flex-wrap gap-3 mt-2 text-xs justify-center">
          <div className="flex items-center gap-2"><div className="w-6 h-0.5" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #2563eb 0, #2563eb 4px, transparent 4px, transparent 8px)' }}></div><span className="text-gray-500">R1 (dashed)</span></div>
          <div className="flex items-center gap-2"><div className="w-6 h-0.5 bg-blue-500"></div><span className="text-gray-500">R2 (drag to adjust)</span></div>
        </div>
      </div>

      <div className="lg:w-56 space-y-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <h4 className="font-bold text-sm mb-2">📋 R2 Schedule</h4>
          <table className="w-full text-xs">
            <thead className="bg-gray-200"><tr><th className="px-1 py-1 text-left">Activity</th><th className="px-1 py-1">Start</th><th className="px-1 py-1">End</th></tr></thead>
            <tbody>
              <tr className="text-gray-600"><td className="px-1 py-1">Mob</td><td className="px-1 py-1 text-center">1</td><td className="px-1 py-1 text-center">{MOB_DAYS}</td></tr>
              {['exc', 'pipe', 'back'].map(id => (<tr key={id} style={{ color: colors[id] }}><td className="px-1 py-1">{names[id].split(' ')[0]}</td><td className="px-1 py-1 text-center font-bold">{r2Lines[id].start}</td><td className="px-1 py-1 text-center">{r2Lines[id].end}</td></tr>))}
            </tbody>
          </table>
          <div className="mt-2 pt-2 border-t text-center"><span className="text-gray-500 text-xs">Project End:</span><span className="ml-1 font-bold text-blue-600">{Math.max(r2Lines.exc.end, r2Lines.pipe.end, r2Lines.back.end)} days</span></div>
        </div>

        <div className={`rounded-lg p-3 text-sm ${buffer1Ok && buffer2Ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <h4 className="font-bold mb-1">{buffer1Ok && buffer2Ok ? '✅ Buffers OK' : '⚠️ Check Buffers'}</h4>
          <div className={`text-xs ${buffer1Ok ? 'text-green-600' : 'text-red-600'}`}>Exc→Pipe: {buffer1}d {buffer1Ok ? '✓' : `(need ${DEFAULT_BUFFER})`}</div>
          <div className={`text-xs ${buffer2Ok ? 'text-green-600' : 'text-red-600'}`}>Pipe→Back: {buffer2}d {buffer2Ok ? '✓' : `(need ${DEFAULT_BUFFER})`}</div>
        </div>

        <div className={`rounded-lg p-3 text-sm ${r2Conflicts.length === 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <h4 className="font-bold mb-1">{r2Conflicts.length === 0 ? '✅ No Conflicts' : `❌ ${r2Conflicts.length} Conflict(s)`}</h4>
          {r2Conflicts.slice(0, 2).map((c, i) => (<div key={i} className="text-xs text-red-600">Day {c.day}: {c.bName} passes {c.aName}</div>))}
        </div>
      </div>
    </div>
  );
}

// ==================== FLASH CARD COMPONENT ====================
function FlashCard({ title, icon, isOpen, onToggle, children }) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors">
        <span className="font-medium">{icon} {title}</span>
        <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {isOpen && <div className="p-4 bg-white border-t border-gray-200 text-sm text-gray-700">{children}</div>}
    </div>
  );
}

// ==================== LOB CHART FOR R1 (Simple) ====================
function LOBChartR1({ schedule, durations }) {
  const CHART_WIDTH = 500, CHART_HEIGHT = 220;
  const PADDING = { top: 20, right: 25, bottom: 45, left: 55 };
  const PLOT_WIDTH = CHART_WIDTH - PADDING.left - PADDING.right;
  const PLOT_HEIGHT = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const MAX_DAY = Math.max(schedule.excE || 0, schedule.pipeE || 0, schedule.backE || 0, 100) + 10;

  const dayToX = (day) => PADDING.left + (day / MAX_DAY) * PLOT_WIDTH;
  const distToY = (dist) => PADDING.top + PLOT_HEIGHT - (dist / PROJECT_LENGTH) * PLOT_HEIGHT;

  const getLinePoints = (start, end) => {
    if (!start || !end || start <= 0) return '';
    return `${dayToX(start)},${distToY(0)} ${dayToX(end)},${distToY(PROJECT_LENGTH)}`;
  };

  const lines = [
    { id: 'exc', start: schedule.excS, end: schedule.excE, color: '#2563eb', name: 'Excavation' },
    { id: 'pipe', start: schedule.pipeS, end: schedule.pipeE, color: '#16a34a', name: 'Pipe Laying' },
    { id: 'back', start: schedule.backS, end: schedule.backE, color: '#ea580c', name: 'Backfill' },
  ];

  const conflicts = findConflicts(schedule, durations);
  const xTicks = []; for (let d = 0; d <= MAX_DAY; d += 20) xTicks.push(d);
  const yTicks = [0, 4000, 8000, 12000, 16000];

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-3 mb-1 text-xs justify-center">
        {lines.map(l => (<div key={l.id} className="flex items-center gap-1"><div className="w-4 h-0.5 rounded" style={{ backgroundColor: l.color }}></div><span style={{ color: l.color }}>{l.name}</span></div>))}
      </div>
      <svg width="100%" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="bg-white">
        {xTicks.map(day => (<line key={`gx-${day}`} x1={dayToX(day)} y1={PADDING.top} x2={dayToX(day)} y2={CHART_HEIGHT - PADDING.bottom} stroke="#f0f0f0" strokeWidth="1" />))}
        {yTicks.map(dist => (<line key={`gy-${dist}`} x1={PADDING.left} y1={distToY(dist)} x2={CHART_WIDTH - PADDING.right} y2={distToY(dist)} stroke="#f0f0f0" strokeWidth="1" />))}
        <line x1={PADDING.left} y1={CHART_HEIGHT - PADDING.bottom} x2={CHART_WIDTH - PADDING.right} y2={CHART_HEIGHT - PADDING.bottom} stroke="#374151" strokeWidth="1.5" />
        <line x1={PADDING.left} y1={PADDING.top} x2={PADDING.left} y2={CHART_HEIGHT - PADDING.bottom} stroke="#374151" strokeWidth="1.5" />
        {xTicks.map(day => (<text key={`tx-${day}`} x={dayToX(day)} y={CHART_HEIGHT - PADDING.bottom + 16} textAnchor="middle" fontSize="10" fill="#6b7280">{day}</text>))}
        <text x={CHART_WIDTH / 2} y={CHART_HEIGHT - 5} textAnchor="middle" fontSize="11" fill="#374151">Time (days)</text>
        {yTicks.map(dist => (<text key={`ty-${dist}`} x={PADDING.left - 8} y={distToY(dist) + 3} textAnchor="end" fontSize="10" fill="#6b7280">{(dist / 1000)}k</text>))}
        <text x={12} y={CHART_HEIGHT / 2} textAnchor="middle" transform={`rotate(-90, 12, ${CHART_HEIGHT / 2})`} fontSize="11" fill="#374151">Distance (ft)</text>
        {lines.map(l => (<polyline key={l.id} points={getLinePoints(l.start, l.end)} fill="none" stroke={l.color} strokeWidth="2.5" />))}
        {conflicts.map((c, i) => (<g key={`conflict-${i}`}><circle cx={dayToX(c.day)} cy={distToY(c.dist)} r="10" fill="#ef4444" opacity="0.2" /><circle cx={dayToX(c.day)} cy={distToY(c.dist)} r="6" fill="#ef4444" /><text x={dayToX(c.day)} y={distToY(c.dist) + 3.5} textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">✕</text></g>))}
      </svg>
      <div className="mt-2 text-center">
        {conflicts.length > 0 ? (
          <div>
            <span className="inline-block px-2 py-1 bg-red-100 text-red-700 text-xs rounded font-medium">{conflicts.length} conflict(s) detected!</span>
            <div className="mt-1 text-xs text-red-600">{conflicts.map((c, i) => (<div key={i}>Day {c.day}: {c.bName} passes {c.aName}</div>))}</div>
          </div>
        ) : (<span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs rounded font-medium">No conflicts detected</span>)}
      </div>
    </div>
  );
}

// ==================== DRAGGABLE LOB CHART FOR R2 ====================
function DraggableLOBChart({ r1Schedule, r2Schedule, onR2Change, durations }) {
  const chartRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);

  const CHART_WIDTH = 650, CHART_HEIGHT = 350;
  const PADDING = { top: 40, right: 30, bottom: 50, left: 60 };
  const PLOT_WIDTH = CHART_WIDTH - PADDING.left - PADDING.right;
  const PLOT_HEIGHT = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const MAX_DAY = 140;

  const dayToX = (day) => PADDING.left + (day / MAX_DAY) * PLOT_WIDTH;
  const xToDay = (x) => Math.round(((x - PADDING.left) / PLOT_WIDTH) * MAX_DAY);
  const distToY = (dist) => PADDING.top + PLOT_HEIGHT - (dist / PROJECT_LENGTH) * PLOT_HEIGHT;

  const getLinePoints = (start, end) => {
    if (!start || !end || start <= 0) return '';
    return `${dayToX(start)},${distToY(0)} ${dayToX(end)},${distToY(PROJECT_LENGTH)}`;
  };

  const handleDragStart = (activity, clientX) => {
    const rect = chartRef.current.getBoundingClientRect();
    const posX = clientX - rect.left;
    const currentStart = r2Schedule[activity + 'S'];
    setDragOffset(posX - dayToX(currentStart));
    setDragging(activity);
  };

  const handleMouseDown = (activity, e) => { e.preventDefault(); e.stopPropagation(); handleDragStart(activity, e.clientX); };
  const handleTouchStart = (activity, e) => { e.preventDefault(); e.stopPropagation(); handleDragStart(activity, e.touches[0].clientX); };

  const handleDragMove = useCallback((clientX) => {
    if (!dragging || !chartRef.current) return;
    const rect = chartRef.current.getBoundingClientRect();
    const newStart = Math.max(MOB_DAYS + 1, Math.min(xToDay(clientX - rect.left - dragOffset), MAX_DAY - 20));
    onR2Change({ ...r2Schedule, [dragging + 'S']: newStart });
  }, [dragging, dragOffset, r2Schedule, onR2Change]);

  const handleMouseMove = useCallback((e) => handleDragMove(e.clientX), [handleDragMove]);
  const handleTouchMove = useCallback((e) => { e.preventDefault(); handleDragMove(e.touches[0].clientX); }, [handleDragMove]);
  const handleDragEnd = useCallback(() => setDragging(null), []);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleDragEnd);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [dragging, handleMouseMove, handleTouchMove, handleDragEnd]);

  const r1Lines = { exc: { start: r1Schedule.excS, end: r1Schedule.excE }, pipe: { start: r1Schedule.pipeS, end: r1Schedule.pipeE }, back: { start: r1Schedule.backS, end: r1Schedule.backE } };
  const r2Lines = { exc: { start: r2Schedule.excS, end: r2Schedule.excS + durations.exc - 1 }, pipe: { start: r2Schedule.pipeS, end: r2Schedule.pipeS + durations.pipe - 1 }, back: { start: r2Schedule.backS, end: r2Schedule.backS + durations.back - 1 } };

  const colors = { exc: { stroke: '#2563eb', name: 'Excavation' }, pipe: { stroke: '#16a34a', name: 'Pipe Laying' }, back: { stroke: '#ea580c', name: 'Backfill' } };
  const r2Sched = { excS: r2Lines.exc.start, excE: r2Lines.exc.end, pipeS: r2Lines.pipe.start, pipeE: r2Lines.pipe.end, backS: r2Lines.back.start, backE: r2Lines.back.end };
  const r2Conflicts = findConflicts(r2Sched, durations);

  const buffer1 = r2Schedule.pipeS - r2Schedule.excS;
  const buffer1Ok = buffer1 === DEFAULT_BUFFER;
  const buffer2 = r2Lines.back.end - r2Lines.pipe.end;
  const buffer2Ok = buffer2 === DEFAULT_BUFFER;

  const xTicks = [0, 20, 40, 60, 80, 100, 120, 140];
  const yTicks = [0, 4000, 8000, 12000, 16000];

  return (
    <div>
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1 min-w-0 overflow-x-auto pb-2">
          <svg ref={chartRef} width={CHART_WIDTH} height={CHART_HEIGHT} className="bg-white border rounded" style={{ minWidth: CHART_WIDTH, touchAction: 'pan-x' }}>
            {xTicks.map(day => (<line key={`gx-${day}`} x1={dayToX(day)} y1={PADDING.top} x2={dayToX(day)} y2={CHART_HEIGHT - PADDING.bottom} stroke="#f3f4f6" strokeWidth="1" />))}
            {yTicks.map(dist => (<line key={`gy-${dist}`} x1={PADDING.left} y1={distToY(dist)} x2={CHART_WIDTH - PADDING.right} y2={distToY(dist)} stroke="#f3f4f6" strokeWidth="1" />))}
            <line x1={PADDING.left} y1={CHART_HEIGHT - PADDING.bottom} x2={CHART_WIDTH - PADDING.right} y2={CHART_HEIGHT - PADDING.bottom} stroke="#374151" strokeWidth="2" />
            <line x1={PADDING.left} y1={PADDING.top} x2={PADDING.left} y2={CHART_HEIGHT - PADDING.bottom} stroke="#374151" strokeWidth="2" />
            {xTicks.map(day => (<text key={`tx-${day}`} x={dayToX(day)} y={CHART_HEIGHT - PADDING.bottom + 18} textAnchor="middle" fontSize="11" fill="#6b7280">{day}</text>))}
            <text x={CHART_WIDTH / 2} y={CHART_HEIGHT - 8} textAnchor="middle" fontSize="12" fill="#374151">Time (days)</text>
            {yTicks.map(dist => (<text key={`ty-${dist}`} x={PADDING.left - 10} y={distToY(dist) + 4} textAnchor="end" fontSize="11" fill="#6b7280">{(dist / 1000)}k</text>))}
            <text x={15} y={CHART_HEIGHT / 2} textAnchor="middle" transform={`rotate(-90, 15, ${CHART_HEIGHT / 2})`} fontSize="12" fill="#374151">Distance (ft)</text>

            {['exc', 'pipe', 'back'].map(id => (<polyline key={`r1-${id}`} points={getLinePoints(r1Lines[id].start, r1Lines[id].end)} fill="none" stroke={colors[id].stroke} strokeWidth="2" strokeDasharray="6,4" opacity="0.4" />))}

            {['exc', 'pipe', 'back'].map(id => (
              <g key={`r2-${id}`}>
                <polyline points={getLinePoints(r2Lines[id].start, r2Lines[id].end)} fill="none" stroke="transparent" strokeWidth="30" style={{ cursor: 'grab', touchAction: 'none' }} onMouseDown={(e) => handleMouseDown(id, e)} onTouchStart={(e) => handleTouchStart(id, e)} />
                <polyline points={getLinePoints(r2Lines[id].start, r2Lines[id].end)} fill="none" stroke={colors[id].stroke} strokeWidth="3" style={{ pointerEvents: 'none' }} />
                <circle cx={dayToX(r2Lines[id].start)} cy={distToY(0)} r="12" fill={colors[id].stroke} stroke="white" strokeWidth="3" style={{ cursor: 'grab', touchAction: 'none' }} onMouseDown={(e) => handleMouseDown(id, e)} onTouchStart={(e) => handleTouchStart(id, e)} />
              </g>
            ))}

            {r2Conflicts.map((c, i) => (<g key={`r2c-${i}`}><circle cx={dayToX(c.day)} cy={distToY(c.dist)} r="10" fill="#ef4444" opacity="0.15" /><circle cx={dayToX(c.day)} cy={distToY(c.dist)} r="6" fill="#ef4444" /><text x={dayToX(c.day)} y={distToY(c.dist) + 3.5} textAnchor="middle" fontSize="9" fill="white" fontWeight="bold">✕</text></g>))}
          </svg>
        </div>

        <div className="lg:w-56 space-y-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <h4 className="font-bold text-sm mb-2">R2 Schedule</h4>
            <table className="w-full text-xs">
              <thead className="bg-gray-200"><tr><th className="px-1 py-1 text-left">Activity</th><th className="px-1 py-1">Start</th><th className="px-1 py-1">End</th></tr></thead>
              <tbody>
                <tr className="text-gray-600"><td className="px-1 py-1">Mob</td><td className="px-1 py-1 text-center">1</td><td className="px-1 py-1 text-center">{MOB_DAYS}</td></tr>
                <tr style={{ color: colors.exc.stroke }}><td className="px-1 py-1">Exc</td><td className="px-1 py-1 text-center font-bold">{r2Lines.exc.start}</td><td className="px-1 py-1 text-center">{r2Lines.exc.end}</td></tr>
                <tr style={{ color: colors.pipe.stroke }}><td className="px-1 py-1">Pipe</td><td className="px-1 py-1 text-center font-bold">{r2Lines.pipe.start}</td><td className="px-1 py-1 text-center">{r2Lines.pipe.end}</td></tr>
                <tr style={{ color: colors.back.stroke }}><td className="px-1 py-1">Back</td><td className="px-1 py-1 text-center font-bold">{r2Lines.back.start}</td><td className="px-1 py-1 text-center">{r2Lines.back.end}</td></tr>
              </tbody>
            </table>
            <div className="mt-2 pt-2 border-t text-center"><span className="text-gray-500 text-xs">Project End:</span><span className="ml-1 font-bold text-blue-600">{Math.max(r2Lines.exc.end, r2Lines.pipe.end, r2Lines.back.end)} days</span></div>
          </div>

          <div className={`rounded-lg p-3 text-sm ${buffer1Ok && buffer2Ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <h4 className="font-bold mb-1">{buffer1Ok && buffer2Ok ? 'Buffers OK' : 'Check Buffers'}</h4>
            <div className={`text-xs ${buffer1Ok ? 'text-green-600' : 'text-red-600'}`}>Exc to Pipe: {buffer1}d {buffer1Ok ? '✓' : `(need ${DEFAULT_BUFFER})`}</div>
            <div className={`text-xs ${buffer2Ok ? 'text-green-600' : 'text-red-600'}`}>Pipe to Back: {buffer2}d {buffer2Ok ? '✓' : `(need ${DEFAULT_BUFFER})`}</div>
          </div>

          <div className={`rounded-lg p-3 text-sm ${r2Conflicts.length === 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <h4 className="font-bold mb-1">{r2Conflicts.length === 0 ? 'No Conflicts' : `${r2Conflicts.length} Conflict(s)`}</h4>
            {r2Conflicts.length > 0 && r2Conflicts.slice(0, 2).map((c, i) => (<div key={i} className="text-xs text-red-600">Day {c.day}: {c.bName} passes {c.aName}</div>))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mt-3 text-xs justify-center">
        <div className="flex items-center gap-2"><div className="w-8 h-0.5 bg-blue-500" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #2563eb 0, #2563eb 6px, transparent 6px, transparent 10px)' }}></div><span className="text-gray-500">R1 Schedule (dashed)</span></div>
        <div className="flex items-center gap-2"><div className="w-8 h-0.5 bg-blue-500"></div><span className="text-gray-500">R2 Schedule (solid - drag to adjust)</span></div>
      </div>
    </div>
  );
}

Calc.pipe.rate < r5Calc.exc.rate ? excS + r5Buffer : excE + r5Buffer - pipeDur + 1;
    const pipeE = pipeS + pipeDur - 1;
    const backS = r5Calc.back.rate < r5Calc.pipe.rate ? pipeS + r5Buffer : pipeE + r5Buffer - backDur + 1;
    const backE = backS + backDur - 1;
    return { excS, excE, excDur, excRate: r5Calc.exc.rate, excCost: r5Calc.exc.cost, pipeS, pipeE, pipeDur, pipeRate: r5Calc.pipe.rate, pipeCost: r5Calc.pipe.cost, backS, backE, backDur, backRate: r5Calc.back.rate, backCost: r5Calc.back.cost, end: Math.max(excE, pipeE, backE) };
  }, [r5Calc, r5Buffer]);

  const r5Cost = useMemo(() => {
    const excC = r5.excDur * r5.excCost, pipeC = r5.pipeDur * r5.pipeCost, backC = r5.backDur * r5.backCost;
    const direct = MOB_COST + excC + pipeC + backC;
    const indirect = Math.round(direct * INDIRECT_RATE), profit = Math.round((direct + indirect) * PROFIT_RATE);
    return { direct, indirect, profit, total: direct + indirect + profit, excC, pipeC, backC };
  }, [r5]);

  const genLOB = (schedules) => {
    const data = [];
    const maxDay = Math.max(...schedules.map(s => s.end || 0), 100) + 10;
    for (let d = 0; d <= maxDay; d += 2) {
      const pt = { day: d };
      schedules.forEach((s, i) => {
        ['exc', 'pipe', 'back'].forEach(type => {
          const start = s[type + 'S'], end = s[type + 'E'];
          if (start > 0 && end > 0) pt[type + i] = d < start ? 0 : d > end ? PROJECT_LENGTH : ((d - start) / (end - start)) * PROJECT_LENGTH;
        });
      });
      data.push(pt);
    }
    return data;
  };

  const BudgetTable = ({ cost, durExc, durPipe, durBack, costExc, costPipe, costBack }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
      <table className="w-full border"><tbody>
        <tr><td className="px-2 py-1 border">Mobilization</td><td className="px-2 py-1 border text-right">${MOB_COST.toLocaleString()}</td></tr>
        <tr><td className="px-2 py-1 border">Excavation ({durExc}d x ${costExc})</td><td className="px-2 py-1 border text-right">${cost.excC.toLocaleString()}</td></tr>
        <tr><td className="px-2 py-1 border">Pipe Laying ({durPipe}d x ${costPipe})</td><td className="px-2 py-1 border text-right">${cost.pipeC.toLocaleString()}</td></tr>
        <tr><td className="px-2 py-1 border">Backfill ({durBack}d x ${costBack})</td><td className="px-2 py-1 border text-right">${cost.backC.toLocaleString()}</td></tr>
        <tr className="bg-gray-100 font-bold"><td className="px-2 py-1 border">Direct Total</td><td className="px-2 py-1 border text-right">${cost.direct.toLocaleString()}</td></tr>
      </tbody></table>
      <table className="w-full border"><tbody>
        <tr><td className="px-2 py-1 border">Direct Cost</td><td className="px-2 py-1 border text-right">${cost.direct.toLocaleString()}</td></tr>
        <tr><td className="px-2 py-1 border">Indirect (30%)</td><td className="px-2 py-1 border text-right">${cost.indirect.toLocaleString()}</td></tr>
        <tr><td className="px-2 py-1 border">Profit (5%)</td><td className="px-2 py-1 border text-right">${cost.profit.toLocaleString()}</td></tr>
        <tr className="bg-green-100 font-bold text-lg"><td className="px-2 py-1 border">TOTAL</td><td className="px-2 py-1 border text-right">${cost.total.toLocaleString()}</td></tr>
      </tbody></table>
    </div>
  );

  const handleR1Complete = (schedule) => {
    setR1Schedule(schedule);
    setR2Schedule({ excS: MOB_DAYS + 1, pipeS: MOB_DAYS + 1 + DEFAULT_BUFFER, backS: MOB_DAYS + 1 });
    setGameResults(prev => ({ ...prev, r1: schedule }));
    setRound(3);
  };

  const handleR2Complete = () => { setGameResults(prev => ({ ...prev, r2: { ...r2Full, cost: r2Cost.total } })); setRound(4); };
  const handleR3Complete = () => { setGameResults(prev => ({ ...prev, r3: { ...r3, buffer: r3Buffer } })); setRound(5); };
  const handleR4Complete = () => { setGameResults(prev => ({ ...prev, r4: { end: r4.end, cost: r4Cost.total, equipment: r4Eq } })); setRound(6); };

  const handleR5Complete = async () => {
    const r5Pass = r5.end <= TARGET_DAYS && r5Cost.total <= TARGET_COST;
    const r5Results = { end: r5.end, cost: r5Cost.total, buffer: r5Buffer, config: r5Config, pass: r5Pass };
    setGameResults(prev => ({ ...prev, r5: r5Results }));
    await submitToGoogleSheets('game-results', { sessionId, timestamp: new Date().toISOString(), studentId: preSurveyData?.demographics?.studentId, r1: gameResults.r1, r2: gameResults.r2, r3: gameResults.r3, r4: gameResults.r4, r5: r5Results });
    setRound(7);
  };


  // ROUND 0: INTRO
  if (round === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="text-center text-white mb-6">
            <h1 className="text-4xl font-bold">LOB SIMULATION GAME</h1>
            <p className="text-blue-200">5-Round Educational Simulation</p>
          </div>
          <div className="bg-white rounded-xl p-5">
            <h2 className="text-xl font-bold text-blue-900 border-b pb-2 mb-4">PROJECT OVERVIEW</h2>
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm leading-relaxed text-blue-900">This simulation places you in the role of a construction planner responsible for scheduling a major water pipeline project. Over five rounds, you will explore how crew productivity, spacing (buffers), and activity sequencing influence progress using the Line of Balance (LOB) method.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div className="bg-blue-50 p-3 rounded"><div className="text-gray-500">Project</div><div className="font-bold">College Station Water Pipeline</div></div>
              <div className="bg-blue-50 p-3 rounded"><div className="text-gray-500">Pipeline Type</div><div className="font-bold">24 inch Prestressed Concrete Cylinder Pipe</div></div>
              <div className="bg-blue-50 p-3 rounded"><div className="text-gray-500">Total Length</div><div className="font-bold text-xl">{PROJECT_LENGTH.toLocaleString()} ft</div></div>
              <div className="bg-blue-50 p-3 rounded"><div className="text-gray-500">Mobilization</div><div className="font-bold">{MOB_DAYS} days - ${MOB_COST.toLocaleString()}</div></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5">
            <h2 className="text-xl font-bold text-blue-900 border-b pb-2 mb-4">CREW DEFINITIONS</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm font-bold table-auto">
                <thead className="bg-blue-100"><tr><th className="px-3 py-3 text-left">Crew</th><th className="px-3 py-3 text-left">Activity</th><th className="px-3 py-3 text-left">Equipment</th><th className="px-3 py-3 text-right">Daily Cost</th><th className="px-3 py-3 text-right">Rate (ft/day)</th></tr></thead>
                <tbody>
                  <tr className="bg-blue-50 border-b"><td className="px-3 py-3 text-blue-700">Crew A</td><td className="px-3 py-3">{CREWS.exc.name}</td><td className="px-3 py-3">{CREWS.exc.equipment}</td><td className="px-3 py-3 text-right">${CREWS.exc.cost}</td><td className="px-3 py-3 text-right">{CREWS.exc.rate}</td></tr>
                  <tr className="bg-green-50 border-b"><td className="px-3 py-3 text-green-700">Crew B</td><td className="px-3 py-3">{CREWS.pipe.name}</td><td className="px-3 py-3">{CREWS.pipe.equipment}</td><td className="px-3 py-3 text-right">${CREWS.pipe.cost}</td><td className="px-3 py-3 text-right">{CREWS.pipe.rate}</td></tr>
                  <tr className="bg-orange-50"><td className="px-3 py-3 text-orange-700">Crew C</td><td className="px-3 py-3">{CREWS.back.name}</td><td className="px-3 py-3">{CREWS.back.equipment}</td><td className="px-3 py-3 text-right">${CREWS.back.cost}</td><td className="px-3 py-3 text-right">{CREWS.back.rate}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5">
            <h2 className="text-xl font-bold text-blue-900 mb-4">Ready to Begin?</h2>
            <p className="text-gray-600 mb-4">Before starting the game, you will complete a short survey to help us understand your background.</p>
            <button onClick={() => setRound(1)} className="w-full bg-blue-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-blue-700">Begin Survey</button>
          </div>
        </div>
      </div>
    );
  }

  // ROUND 1: PRE-SURVEY
  if (round === 1) {
    return <PreSurvey sessionId={sessionId} onComplete={(data) => { setPreSurveyData(data); setRound(2); }} />;
  }

  // ROUND 7: GAME SUMMARY
  if (round === 7) {
    const r5Pass = gameResults.r5?.pass;
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 p-4">
        <div className="max-w-4xl mx-auto bg-white rounded-xl p-6 space-y-6">
          <div className="text-center mb-4">
            <div className="text-6xl">{r5Pass ? '🏆' : '📊'}</div>
            <h1 className="text-3xl font-bold text-blue-900">Game Complete!</h1>
            <p className="text-gray-600">Great job, {preSurveyData?.demographics?.name}!</p>
          </div>
          <div className={`p-4 rounded-lg ${r5Pass ? 'bg-green-100 border-2 border-green-500' : 'bg-yellow-100 border-2 border-yellow-500'}`}>
            <h3 className="font-bold text-lg">{r5Pass ? 'Constraints Met!' : 'Constraints Not Met'}</h3>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div>Duration: <span className={`font-bold ${gameResults.r5?.end <= TARGET_DAYS ? 'text-green-600' : 'text-red-600'}`}>{gameResults.r5?.end} days</span> <span className="text-gray-400">(limit: {TARGET_DAYS})</span></div>
              <div>Cost: <span className={`font-bold ${gameResults.r5?.cost <= TARGET_COST ? 'text-green-600' : 'text-red-600'}`}>${gameResults.r5?.cost?.toLocaleString()}</span> <span className="text-gray-400">(limit: ${TARGET_COST.toLocaleString()})</span></div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-bold text-lg mb-3">Your Results by Round</h3>
            <table className="w-full text-sm border">
              <thead className="bg-gray-100"><tr><th className="px-3 py-2 border text-left">Round</th><th className="px-3 py-2 border text-center">Duration</th><th className="px-3 py-2 border text-center">Cost</th><th className="px-3 py-2 border text-center">Notes</th></tr></thead>
              <tbody>
                <tr><td className="px-3 py-2 border">R1: Bar Chart</td><td className="px-3 py-2 border text-center">{gameResults.r1?.end || '-'} days</td><td className="px-3 py-2 border text-center">-</td><td className="px-3 py-2 border text-center text-gray-500">Initial schedule</td></tr>
                <tr><td className="px-3 py-2 border">R2: LOB Analysis</td><td className="px-3 py-2 border text-center">{gameResults.r2?.end || '-'} days</td><td className="px-3 py-2 border text-center">${gameResults.r2?.cost?.toLocaleString() || '-'}</td><td className="px-3 py-2 border text-center text-gray-500">With {DEFAULT_BUFFER}-day buffer</td></tr>
                <tr><td className="px-3 py-2 border">R3: Buffer Analysis</td><td className="px-3 py-2 border text-center">{gameResults.r3?.end || '-'} days</td><td className="px-3 py-2 border text-center">-</td><td className="px-3 py-2 border text-center text-gray-500">Buffer = {gameResults.r3?.buffer} days</td></tr>
                <tr><td className="px-3 py-2 border">R4: Rate Analysis</td><td className="px-3 py-2 border text-center">{gameResults.r4?.end || '-'} days</td><td className="px-3 py-2 border text-center">${gameResults.r4?.cost?.toLocaleString() || '-'}</td><td className="px-3 py-2 border text-center text-gray-500">Equipment selection</td></tr>
                <tr className="bg-blue-50 font-bold"><td className="px-3 py-2 border">R5: Optimization</td><td className="px-3 py-2 border text-center">{gameResults.r5?.end} days</td><td className="px-3 py-2 border text-center">${gameResults.r5?.cost?.toLocaleString()}</td><td className="px-3 py-2 border text-center">{r5Pass ? 'Pass' : 'Not met'}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-bold text-lg mb-3">Key Learning Insights</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2"><span className="text-blue-500 font-bold">1.</span><div><strong>Activity Sequence Matters:</strong> In linear projects like pipelines, crews must work in sequence (Excavation then Pipe Laying then Backfill).</div></div>
              <div className="flex items-start gap-2"><span className="text-blue-500 font-bold">2.</span><div><strong>LOB Shows Conflicts:</strong> Line of Balance charts visualize crew progress. When lines cross, it indicates a conflict.</div></div>
              <div className="flex items-start gap-2"><span className="text-blue-500 font-bold">3.</span><div><strong>Buffers Prevent Conflicts:</strong> Adding buffer days creates safety margin. Larger buffers = safer but longer duration.</div></div>
              <div className="flex items-start gap-2"><span className="text-blue-500 font-bold">4.</span><div><strong>Production Rate Trade-offs:</strong> Faster equipment reduces duration but increases daily cost.</div></div>
              <div className="flex items-start gap-2"><span className="text-blue-500 font-bold">5.</span><div><strong>Duration vs Cost:</strong> These are often competing objectives requiring careful optimization.</div></div>
            </div>
          </div>
          <button onClick={() => setRound(8)} className="w-full bg-green-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-green-700">Continue to Final Survey</button>
        </div>
      </div>
    );
  }

  // ROUND 8: POST-SURVEY
  if (round === 8) {
    return <PostSurvey sessionId={sessionId} playerName={preSurveyData?.demographics?.name} studentId={preSurveyData?.demographics?.studentId} preKnowledgeScore={preSurveyData?.knowledgeScore} preSEScore={preSurveyData?.seScore} onComplete={(data) => { setPostSurveyData(data); setRound(9); }} />;
  }

  // ROUND 9: THANK YOU
  if (round === 9) {
    return <ThankYou />;
  }


  // GAME ROUNDS 2-6 (R1-R5)
  const titles = { 2: 'R1: Bar Chart', 3: 'R2: LOB Analysis', 4: 'R3: Buffer Analysis', 5: 'R4: Rate Analysis', 6: 'R5: Optimization' };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-blue-900 text-white py-2 px-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <span><span className="text-blue-300">Player:</span> <strong>{preSurveyData?.demographics?.name}</strong></span>
          <span className="font-bold">{titles[round]}</span>
          <div className="text-sm">Target: {TARGET_DAYS}d | ${TARGET_COST / 1000}K</div>
        </div>
      </div>

      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-2 flex gap-1">
          {[2, 3, 4, 5, 6].map(r => (<div key={r} className={`flex-1 h-2 rounded ${r < round ? 'bg-green-500' : r === round ? 'bg-blue-500' : 'bg-gray-200'}`} />))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-4">

        {round === 2 && <Round1 onComplete={handleR1Complete} />}

        {round === 3 && r1Schedule && (
          <>
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
              <h3 className="font-bold text-xl text-yellow-900">Round 2: LOB Analysis</h3>
              <p className="text-gray-600 mt-1">Your R1 schedule may have conflicts. Use the LOB chart to understand why, then adjust to create a conflict-free schedule with {DEFAULT_BUFFER}-day buffers.</p>
            </div>

            <div className="bg-white rounded-lg shadow p-4 space-y-3">
              <h4 className="font-bold text-gray-700">Learning Resources (click to expand)</h4>
              <FlashCard title="What is Line of Balance (LOB)?" icon="📊" isOpen={openCards.lob} onToggle={() => toggleCard('lob')}><p>LOB is a scheduling technique for repetitive or linear projects. Each line shows a crew progress over time (x-axis) vs distance (y-axis). The slope indicates production rate.</p></FlashCard>
              <FlashCard title="How to identify conflicts?" icon="⚠️" isOpen={openCards.conflict} onToggle={() => toggleCard('conflict')}><p>A conflict occurs when lines cross - meaning two crews would be at the same location at the same time. The red X markers show where conflicts exist.</p></FlashCard>
              <FlashCard title="What are buffers?" icon="🛡️" isOpen={openCards.buffer} onToggle={() => toggleCard('buffer')}><p>Buffers are safety margins (in days) between activities. They prevent crews from getting too close and provide contingency for delays.</p></FlashCard>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h4 className="font-bold text-gray-700 mb-3">Your R1 Schedule (LOB View)</h4>
              <LOBChartR1 schedule={r1Schedule} durations={dur} />
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h4 className="font-bold text-gray-700 mb-3">Create Your R2 Schedule</h4>
              <p className="text-sm text-gray-600 mb-3">Drag the colored dots or lines to adjust start times. Goal: {DEFAULT_BUFFER}-day buffers, no conflicts.</p>
              <DraggableLOBChart r1Schedule={r1Schedule} r2Schedule={r2Schedule} onR2Change={setR2Schedule} durations={dur} />
            </div>

            {r2Valid && (
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-bold mb-2">R2 Budget</h3>
                <BudgetTable cost={r2Cost} durExc={dur.exc} durPipe={dur.pipe} durBack={dur.back} costExc={CREWS.exc.cost} costPipe={CREWS.pipe.cost} costBack={CREWS.back.cost} />
              </div>
            )}

            <button onClick={handleR2Complete} disabled={!r2Valid} className="w-full py-4 bg-green-600 text-white rounded-lg font-bold text-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed">
              {r2Valid ? 'Complete R2' : 'Fix buffers and conflicts to continue'}
            </button>
          </>
        )}

        {round === 4 && (
          <>
            <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
              <h3 className="font-bold text-xl text-green-900">Round 3: Buffer Analysis</h3>
              <p className="text-gray-600 mt-1">Explore how changing the buffer affects project duration.</p>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-4">
                <span className="font-bold">Buffer:</span>
                <input type="range" min="1" max="15" value={r3Buffer} onChange={e => setR3Buffer(+e.target.value)} className="flex-1" />
                <span className="text-3xl font-bold text-green-600 w-16 text-center">{r3Buffer}</span>
                <span>days</span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-bold mb-2">Schedule (Buffer = {r3Buffer} days)</h3>
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
              <h3 className="font-bold mb-2">LOB Comparison: R2 (dashed) vs R3 (solid)</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={genLOB([r2Correct, r3])} margin={{ top: 10, right: 30, bottom: 30, left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" label={{ value: 'Duration (day)', position: 'insideBottom', offset: -5 }} />
                  <YAxis domain={[0, PROJECT_LENGTH]} tickFormatter={v => (v/1000).toFixed(0)+'k'} label={{ value: 'Distance (ft)', angle: -90, position: 'insideLeft', offset: 10 }} />
                  <Tooltip />
                  <Legend verticalAlign="top" height={36} />
                  <Line type="linear" dataKey="exc0" stroke="#2563eb" strokeWidth={1} strokeDasharray="5 5" name="Exc R2" dot={false} />
                  <Line type="linear" dataKey="pipe0" stroke="#16a34a" strokeWidth={1} strokeDasharray="5 5" name="Pipe R2" dot={false} />
                  <Line type="linear" dataKey="back0" stroke="#ea580c" strokeWidth={1} strokeDasharray="5 5" name="Back R2" dot={false} />
                  <Line type="linear" dataKey="exc1" stroke="#2563eb" strokeWidth={3} name="Exc R3" dot={false} />
                  <Line type="linear" dataKey="pipe1" stroke="#16a34a" strokeWidth={3} name="Pipe R3" dot={false} />
                  <Line type="linear" dataKey="back1" stroke="#ea580c" strokeWidth={3} name="Back R3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-yellow-50 p-4 rounded"><strong>Key Insight:</strong> Buffer increases = Duration increases, but Cost stays the same!</div>
            <button onClick={handleR3Complete} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold">Complete R3</button>
          </>
        )}


        {round === 5 && (
          <>
            <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded">
              <h3 className="font-bold text-xl text-orange-900">Round 4: Rate Analysis</h3>
              <p className="text-gray-600 mt-1">Select different equipment to see how production rates affect duration and cost.</p>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-bold mb-3">Equipment Selection</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['exc', 'pipe', 'back'].map((type) => (
                  <div key={type} className="border rounded p-3">
                    <h4 className={`font-bold mb-2 ${type === 'exc' ? 'text-blue-700' : type === 'pipe' ? 'text-green-700' : 'text-orange-700'}`}>
                      {type === 'exc' ? 'Excavation' : type === 'pipe' ? 'Pipe Laying' : 'Backfill'}
                    </h4>
                    {EQUIPMENT[type].map((eq, i) => (
                      <label key={i} className={`block p-2 rounded mb-1 cursor-pointer ${r4Eq[type] === i ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-50'}`}>
                        <input type="radio" checked={r4Eq[type] === i} onChange={() => setR4Eq(p => ({...p, [type]: i}))} className="mr-2" />
                        {eq.name}
                        <div className="text-xs text-gray-500 ml-5">{eq.rate} ft/day | ${eq.cost}/day</div>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-bold mb-2">R4 Schedule</h3>
              <table className="w-full text-sm border">
                <thead className="bg-gray-100"><tr><th className="px-2 py-1 border">Activity</th><th className="px-2 py-1 border">Equipment</th><th className="px-2 py-1 border">Rate</th><th className="px-2 py-1 border">Duration</th><th className="px-2 py-1 border">Cost/day</th><th className="px-2 py-1 border">Start</th><th className="px-2 py-1 border">End</th></tr></thead>
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
              <h3 className="font-bold mb-2">LOB Comparison: R2 (dashed) vs R4 (solid)</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={genLOB([r2Correct, r4])} margin={{ top: 10, right: 30, bottom: 30, left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" label={{ value: 'Duration (day)', position: 'insideBottom', offset: -5 }} />
                  <YAxis domain={[0, PROJECT_LENGTH]} tickFormatter={v => (v/1000).toFixed(0)+'k'} label={{ value: 'Distance (ft)', angle: -90, position: 'insideLeft', offset: 10 }} />
                  <Tooltip />
                  <Legend verticalAlign="top" height={36} />
                  <Line type="linear" dataKey="exc0" stroke="#2563eb" strokeWidth={1} strokeDasharray="5 5" name="Exc R2" dot={false} />
                  <Line type="linear" dataKey="pipe0" stroke="#16a34a" strokeWidth={1} strokeDasharray="5 5" name="Pipe R2" dot={false} />
                  <Line type="linear" dataKey="back0" stroke="#ea580c" strokeWidth={1} strokeDasharray="5 5" name="Back R2" dot={false} />
                  <Line type="linear" dataKey="exc1" stroke="#2563eb" strokeWidth={3} name="Exc R4" dot={false} />
                  <Line type="linear" dataKey="pipe1" stroke="#16a34a" strokeWidth={3} name="Pipe R4" dot={false} />
                  <Line type="linear" dataKey="back1" stroke="#ea580c" strokeWidth={3} name="Back R4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-bold mb-2">R4 Budget</h3>
              <BudgetTable cost={r4Cost} durExc={r4.excDur} durPipe={r4.pipeDur} durBack={r4.backDur} costExc={r4.excCost} costPipe={r4.pipeCost} costBack={r4.backCost} />
            </div>

            <button onClick={handleR4Complete} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold">Complete R4</button>
          </>
        )}

        {round === 6 && (
          <>
            <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded">
              <h3 className="font-bold text-xl text-purple-900">Round 5: Optimization Challenge</h3>
              <p className="text-gray-600 mt-1">Meet both constraints: {TARGET_DAYS} days or less AND ${TARGET_COST.toLocaleString()} or less</p>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-bold mb-3">Equipment Configuration (Multiple Units)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['exc', 'pipe', 'back'].map((type) => (
                  <div key={type} className={`border rounded p-3 ${type === 'exc' ? 'bg-blue-50' : type === 'pipe' ? 'bg-green-50' : 'bg-orange-50'}`}>
                    <h4 className={`font-bold mb-2 ${type === 'exc' ? 'text-blue-700' : type === 'pipe' ? 'text-green-700' : 'text-orange-700'}`}>
                      {type === 'exc' ? 'Excavation' : type === 'pipe' ? 'Pipe Laying' : 'Backfill'}
                    </h4>
                    {Object.keys(r5Config[type]).map((key) => {
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
              <div className="mt-4 p-3 bg-purple-50 rounded flex items-center gap-4">
                <span className="font-bold">Buffer:</span>
                <input type="range" min="1" max="10" value={r5Buffer} onChange={e => setR5Buffer(+e.target.value)} className="flex-1" />
                <span className="text-2xl font-bold text-purple-600 w-12">{r5Buffer}</span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-bold mb-2">R5 Schedule</h3>
              <table className="w-full text-sm border">
                <thead className="bg-gray-100"><tr><th className="px-2 py-1 border">Activity</th><th className="px-2 py-1 border">Rate</th><th className="px-2 py-1 border">Duration</th><th className="px-2 py-1 border">Cost/day</th><th className="px-2 py-1 border">Start</th><th className="px-2 py-1 border">End</th></tr></thead>
                <tbody>
                  <tr className="bg-gray-50"><td className="px-2 py-1 border">Mobilization</td><td className="px-2 py-1 border text-center">-</td><td className="px-2 py-1 border text-center">{MOB_DAYS}</td><td className="px-2 py-1 border text-center">-</td><td className="px-2 py-1 border text-center">1</td><td className="px-2 py-1 border text-center">{MOB_DAYS}</td></tr>
                  <tr className="text-blue-700"><td className="px-2 py-1 border">Excavation</td><td className="px-2 py-1 border text-center">{r5.excRate}</td><td className="px-2 py-1 border text-center font-bold">{r5.excDur}</td><td className="px-2 py-1 border text-center">${r5.excCost}</td><td className="px-2 py-1 border text-center">{r5.excS}</td><td className="px-2 py-1 border text-center">{r5.excE}</td></tr>
                  <tr className="text-green-700"><td className="px-2 py-1 border">Pipe Laying</td><td className="px-2 py-1 border text-center">{r5.pipeRate}</td><td className="px-2 py-1 border text-center font-bold">{r5.pipeDur}</td><td className="px-2 py-1 border text-center">${r5.pipeCost}</td><td className="px-2 py-1 border text-center">{r5.pipeS}</td><td className="px-2 py-1 border text-center">{r5.pipeE}</td></tr>
                  <tr className="text-orange-700"><td className="px-2 py-1 border">Backfill</td><td className="px-2 py-1 border text-center">{r5.backRate}</td><td className="px-2 py-1 border text-center font-bold">{r5.backDur}</td><td className="px-2 py-1 border text-center">${r5.backCost}</td><td className="px-2 py-1 border text-center">{r5.backS}</td><td className="px-2 py-1 border text-center">{r5.backE}</td></tr>
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-bold mb-2">R5 LOB Chart</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={genLOB([r5])} margin={{ top: 10, right: 30, bottom: 30, left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" label={{ value: 'Duration (day)', position: 'insideBottom', offset: -5 }} />
                  <YAxis domain={[0, PROJECT_LENGTH]} tickFormatter={v => (v/1000).toFixed(0)+'k'} label={{ value: 'Distance (ft)', angle: -90, position: 'insideLeft', offset: 10 }} />
                  <Tooltip />
                  <Legend verticalAlign="top" height={36} />
                  <Line type="linear" dataKey="exc0" stroke="#2563eb" strokeWidth={3} name="Excavation" dot={false} />
                  <Line type="linear" dataKey="pipe0" stroke="#16a34a" strokeWidth={3} name="Pipe Laying" dot={false} />
                  <Line type="linear" dataKey="back0" stroke="#ea580c" strokeWidth={3} name="Backfill" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-bold mb-2">Constraints Check</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 rounded-lg text-center ${r5.end <= TARGET_DAYS ? 'bg-green-100 border-2 border-green-500' : 'bg-red-100 border-2 border-red-500'}`}>
                  <div className="text-gray-600">Duration</div>
                  <div className={`text-3xl font-bold ${r5.end <= TARGET_DAYS ? 'text-green-600' : 'text-red-600'}`}>{r5.end} days</div>
                  <div className="text-sm">Target: {TARGET_DAYS} or less {r5.end <= TARGET_DAYS ? '✓' : '✗'}</div>
                </div>
                <div className={`p-4 rounded-lg text-center ${r5Cost.total <= TARGET_COST ? 'bg-green-100 border-2 border-green-500' : 'bg-red-100 border-2 border-red-500'}`}>
                  <div className="text-gray-600">Total Cost</div>
                  <div className={`text-3xl font-bold ${r5Cost.total <= TARGET_COST ? 'text-green-600' : 'text-red-600'}`}>${(r5Cost.total/1000).toFixed(0)}K</div>
                  <div className="text-sm">Target: ${TARGET_COST/1000}K or less {r5Cost.total <= TARGET_COST ? '✓' : '✗'}</div>
                </div>
              </div>
              {(r5.end > TARGET_DAYS || r5Cost.total > TARGET_COST) && <div className="mt-3 p-3 bg-yellow-100 border border-yellow-400 rounded text-yellow-800 font-bold text-center">Keep optimizing...</div>}
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-bold mb-2">R5 Budget</h3>
              <BudgetTable cost={r5Cost} durExc={r5.excDur} durPipe={r5.pipeDur} durBack={r5.backDur} costExc={r5.excCost} costPipe={r5.pipeCost} costBack={r5.backCost} />
            </div>

            <button onClick={handleR5Complete} className="w-full bg-purple-600 text-white py-3 rounded-lg font-bold">Finish Game</button>
          </>
        )}

      </div>
    </div>
  );
}
