import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

// CONSTANTS
const PROJECT_LENGTH = 15840;
const MOB_DAYS = 14;
const MOB_COST = 25000;
const DEFAULT_BUFFER = 5;
const INDIRECT_RATE = 0.30;
const PROFIT_RATE = 0.05;
const TARGET_DAYS = 55;
const TARGET_COST = 550000;

const CREWS = {
  exc: { rate: 220, cost: 1600 },
  pipe: { rate: 180, cost: 2500 },
  back: { rate: 250, cost: 2300 },
};

const DURATIONS = {
  exc: Math.ceil(PROJECT_LENGTH / CREWS.exc.rate),
  pipe: Math.ceil(PROJECT_LENGTH / CREWS.pipe.rate),
  back: Math.ceil(PROJECT_LENGTH / CREWS.back.rate),
};

// HELPERS
const getPositionAtDay = (startDay, rate, currentDay) => {
  if (currentDay < startDay) return 0;
  return Math.min((currentDay - startDay + 1) * rate, PROJECT_LENGTH);
};

const generateLOBData = (schedules, maxDay) => {
  const data = [];
  for (let d = 0; d <= maxDay; d += 2) {
    const pt = { day: d };
    schedules.forEach((s, i) => {
      ['exc', 'pipe', 'back'].forEach(type => {
        const start = s[type + 'S'], end = s[type + 'E'];
        if (start > 0 && end > 0) {
          pt[type + i] = d < start ? 0 : d > end ? PROJECT_LENGTH : ((d - start) / (end - start)) * PROJECT_LENGTH;
        }
      });
    });
    data.push(pt);
  }
  return data;
};

const findFirstConflictDay = (schedule) => {
  const projectEnd = Math.max(schedule.excE, schedule.pipeE, schedule.backE);
  for (let day = MOB_DAYS + 1; day <= projectEnd; day++) {
    const excPos = getPositionAtDay(schedule.excS, CREWS.exc.rate, day);
    const pipePos = getPositionAtDay(schedule.pipeS, CREWS.pipe.rate, day);
    const backPos = getPositionAtDay(schedule.backS, CREWS.back.rate, day);
    if (pipePos > excPos && excPos < PROJECT_LENGTH) return { day, type: 'pipe-exc' };
    if (backPos > pipePos && pipePos < PROJECT_LENGTH) return { day, type: 'back-pipe' };
  }
  return null;
};

// MAIN COMPONENT
export default function Round2({ r1Schedule, onComplete }) {
  const [phase, setPhase] = useState('A');
  
  // Schedules
  const naiveSchedule = useMemo(() => {
    const excS = MOB_DAYS + 1, excE = excS + DURATIONS.exc - 1;
    const pipeS = MOB_DAYS + 1, pipeE = pipeS + DURATIONS.pipe - 1;
    const backS = MOB_DAYS + 1, backE = backS + DURATIONS.back - 1;
    return { excS, excE, pipeS, pipeE, backS, backE, end: Math.max(excE, pipeE, backE) };
  }, []);
  
  const correctedSchedule = useMemo(() => {
    const excS = MOB_DAYS + 1, excE = excS + DURATIONS.exc - 1;
    const pipeS = excS + DEFAULT_BUFFER, pipeE = pipeS + DURATIONS.pipe - 1;
    const backS = pipeE + DEFAULT_BUFFER - DURATIONS.back + 1, backE = backS + DURATIONS.back - 1;
    return { excS, excE, pipeS, pipeE, backS, backE, end: Math.max(excE, pipeE, backE) };
  }, []);
  
  const effectiveR1 = r1Schedule || {
    excS: MOB_DAYS + 1, excE: MOB_DAYS + DURATIONS.exc,
    pipeS: 20, pipeE: 20 + DURATIONS.pipe - 1,
    backS: 44, backE: 44 + DURATIONS.back - 1,
    end: Math.max(MOB_DAYS + DURATIONS.exc, 20 + DURATIONS.pipe - 1, 44 + DURATIONS.back - 1)
  };
  
  const phases = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];
  const nextPhase = () => {
    const idx = phases.indexOf(phase);
    if (idx < phases.length - 1) setPhase(phases[idx + 1]);
  };
  
  // Phase-specific state
  const [reflectionAnswers, setReflectionAnswers] = useState({ q1: null, q2: null });
  const [phaseBAnswer, setPhaseBAnswer] = useState(null);
  const [phaseBSubmitted, setPhaseBSubmitted] = useState(false);
  const [animStep, setAnimStep] = useState(0);
  const [viewDay, setViewDay] = useState(45);
  const [phaseFAnswer, setPhaseFAnswer] = useState(null);
  const [phaseFSubmitted, setPhaseFSubmitted] = useState(false);
  const [bufferTab, setBufferTab] = useState('simple');
  const [quizH, setQuizH] = useState({ q1: null, q2: null, q3: null });
  const [quizHSub, setQuizHSub] = useState({ q1: false, q2: false, q3: false });
  const [calcStep, setCalcStep] = useState(1);
  const [calcAns, setCalcAns] = useState({ s2a: null, s2b: '', s2c: '', s3a: null, s3b: '', s3c: '' });
  const [calcSub, setCalcSub] = useState({ s2a: false, s2b: false, s2c: false, s3a: false, s3b: false, s3c: false });
  
  const conflictInfo = findFirstConflictDay(naiveSchedule);
  const lobDataNaive = useMemo(() => generateLOBData([naiveSchedule], 120), [naiveSchedule]);
  const lobDataR1 = useMemo(() => generateLOBData([effectiveR1], 130), [effectiveR1]);
  const lobDataCorrected = useMemo(() => generateLOBData([correctedSchedule], 130), [correctedSchedule]);
  
  const positions = useMemo(() => ({
    exc: getPositionAtDay(naiveSchedule.excS, CREWS.exc.rate, viewDay),
    pipe: getPositionAtDay(naiveSchedule.pipeS, CREWS.pipe.rate, viewDay),
    back: getPositionAtDay(naiveSchedule.backS, CREWS.back.rate, viewDay)
  }), [naiveSchedule, viewDay]);
  
  const positionsCorrected = useMemo(() => ({
    exc: getPositionAtDay(correctedSchedule.excS, CREWS.exc.rate, viewDay),
    pipe: getPositionAtDay(correctedSchedule.pipeS, CREWS.pipe.rate, viewDay),
    back: getPositionAtDay(correctedSchedule.backS, CREWS.back.rate, viewDay)
  }), [correctedSchedule, viewDay]);
  
  const hasConflict = positions.back > positions.pipe && positions.pipe < PROJECT_LENGTH;
  
  const calcCorrect = { s2a: 'slower', s2b: 20, s2c: 107, s3a: 'faster', s3b: 49, s3c: 112 };
  const step2Done = calcSub.s2a && calcSub.s2b && calcSub.s2c && 
    calcAns.s2a === calcCorrect.s2a && parseInt(calcAns.s2b) === calcCorrect.s2b && parseInt(calcAns.s2c) === calcCorrect.s2c;
  const step3Done = calcSub.s3a && calcSub.s3b && calcSub.s3c && 
    calcAns.s3a === calcCorrect.s3a && parseInt(calcAns.s3b) === calcCorrect.s3b && parseInt(calcAns.s3c) === calcCorrect.s3c;
  
  const cost = useMemo(() => {
    const excC = DURATIONS.exc * CREWS.exc.cost;
    const pipeC = DURATIONS.pipe * CREWS.pipe.cost;
    const backC = DURATIONS.back * CREWS.back.cost;
    const direct = MOB_COST + excC + pipeC + backC;
    const indirect = Math.round(direct * INDIRECT_RATE);
    const profit = Math.round((direct + indirect) * PROFIT_RATE);
    return { excC, pipeC, backC, direct, indirect, profit, total: direct + indirect + profit };
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-blue-900 text-white py-3 px-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <span className="font-bold">Round 2: LOB Analysis</span>
          <span className="text-sm">Phase {phase} of N</span>
        </div>
      </div>
      
      {/* Progress */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-2">
          <div className="flex gap-1">
            {phases.map((p, i) => (
              <div key={p} className={`flex-1 h-2 rounded ${i < phases.indexOf(phase) ? 'bg-green-500' : i === phases.indexOf(phase) ? 'bg-blue-500' : 'bg-gray-200'}`} />
            ))}
          </div>
        </div>
      </div>
      
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        
        {/* PHASE A: Recall R1 */}
        {phase === 'A' && (
          <>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <h3 className="font-bold text-xl">📋 Let's Review Your R1 Journey</h3>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <h4 className="font-bold mb-4">🎮 Your R1 Schedule</h4>
              <table className="w-full text-sm border mb-4">
                <thead className="bg-gray-100">
                  <tr><th className="px-3 py-2 border">Activity</th><th className="px-3 py-2 border">Start</th><th className="px-3 py-2 border">End</th></tr>
                </thead>
                <tbody>
                  <tr className="bg-blue-50"><td className="px-3 py-2 border">⛏️ Excavation</td><td className="px-3 py-2 border text-center font-bold">{effectiveR1.excS}</td><td className="px-3 py-2 border text-center font-bold">{effectiveR1.excE}</td></tr>
                  <tr className="bg-green-50"><td className="px-3 py-2 border">🔧 Pipe Laying</td><td className="px-3 py-2 border text-center font-bold">{effectiveR1.pipeS}</td><td className="px-3 py-2 border text-center font-bold">{effectiveR1.pipeE}</td></tr>
                  <tr className="bg-orange-50"><td className="px-3 py-2 border">🚜 Backfill</td><td className="px-3 py-2 border text-center font-bold">{effectiveR1.backS}</td><td className="px-3 py-2 border text-center font-bold">{effectiveR1.backE}</td></tr>
                </tbody>
              </table>
              <div className="text-center p-3 bg-green-100 rounded">Duration: <strong className="text-2xl text-green-600">{effectiveR1.end} days ✅</strong></div>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <h4 className="font-bold mb-4">🤔 Reflection</h4>
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded">
                  <p className="font-medium mb-2">How did you figure out the schedule?</p>
                  {['calculated', 'guessed', 'pattern'].map(v => (
                    <button key={v} onClick={() => setReflectionAnswers(p => ({...p, q1: v}))}
                      className={`block w-full p-3 rounded border-2 text-left mb-2 ${reflectionAnswers.q1 === v ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                      {v === 'calculated' ? 'I calculated using formulas' : v === 'guessed' ? 'I guessed and checked' : 'I followed a pattern'}
                    </button>
                  ))}
                </div>
                <div className="p-4 bg-gray-50 rounded">
                  <p className="font-medium mb-2">Could you explain WHY Backfill started on Day {effectiveR1.backS}?</p>
                  {['yes', 'kinda', 'no'].map(v => (
                    <button key={v} onClick={() => setReflectionAnswers(p => ({...p, q2: v}))}
                      className={`block w-full p-3 rounded border-2 text-left mb-2 ${reflectionAnswers.q2 === v ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                      {v === 'yes' ? 'Yes, I understand' : v === 'kinda' ? 'Kind of' : 'No, I just moved it until it worked'}
                    </button>
                  ))}
                </div>
              </div>
              {reflectionAnswers.q1 && reflectionAnswers.q2 && (
                <div className="mt-4 p-4 bg-yellow-50 rounded">
                  <p className="text-yellow-800"><strong>💡 Most honest answer?</strong> Trial-and-error! Let's learn the MATH.</p>
                </div>
              )}
            </div>
            {reflectionAnswers.q1 && reflectionAnswers.q2 && (
              <button onClick={nextPhase} className="w-full py-4 bg-blue-600 text-white rounded-lg font-bold text-lg">Continue →</button>
            )}
          </>
        )}
        
        {/* PHASE B: Naive Schedule */}
        {phase === 'B' && (
          <>
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
              <h3 className="font-bold text-xl">💥 What If You Hadn't Adjusted?</h3>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <h4 className="font-bold mb-4">📊 Naive Schedule (All Start Day 15)</h4>
              <div className="space-y-2 mb-4">
                {[
                  { name: 'Excavation', s: naiveSchedule.excS, e: naiveSchedule.excE, c: 'bg-blue-500' },
                  { name: 'Pipe Laying', s: naiveSchedule.pipeS, e: naiveSchedule.pipeE, c: 'bg-green-500' },
                  { name: 'Backfill', s: naiveSchedule.backS, e: naiveSchedule.backE, c: 'bg-orange-500' }
                ].map((bar, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-24 text-sm text-right">{bar.name}</div>
                    <div className="flex-1 h-6 bg-gray-100 rounded relative">
                      <div className={`absolute h-full ${bar.c} rounded text-white text-xs flex items-center justify-center`}
                        style={{ left: `${(bar.s / 120) * 100}%`, width: `${((bar.e - bar.s + 1) / 120) * 100}%` }}>{bar.s}-{bar.e}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-center p-3 bg-blue-100 rounded mb-4">Duration: <strong className="text-xl">{naiveSchedule.end} days</strong></div>
              <p className="text-gray-700">🤔 This is <strong>{effectiveR1.end - naiveSchedule.end} days shorter!</strong> Why didn't we use it?</p>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <p className="font-bold mb-3">Why didn't we use the naive schedule?</p>
              {['shows', 'hides', 'none'].map(v => (
                <button key={v} onClick={() => !phaseBSubmitted && setPhaseBAnswer(v)} disabled={phaseBSubmitted}
                  className={`block w-full p-3 rounded border-2 text-left mb-2 ${
                    !phaseBSubmitted ? (phaseBAnswer === v ? 'border-blue-500 bg-blue-50' : 'border-gray-200')
                    : (v === 'hides' ? 'border-green-500 bg-green-50' : (phaseBAnswer === v ? 'border-red-500 bg-red-50' : 'opacity-50'))
                  }`}>
                  {v === 'shows' ? 'Bar chart shows a hidden conflict' : v === 'hides' ? 'Bar chart HIDES a conflict' : 'No conflict, naive is better'}
                </button>
              ))}
              {!phaseBSubmitted && phaseBAnswer && (
                <button onClick={() => setPhaseBSubmitted(true)} className="px-6 py-2 bg-blue-600 text-white rounded font-bold">Check</button>
              )}
              {phaseBSubmitted && (
                <div className={`p-4 rounded ${phaseBAnswer === 'hides' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {phaseBAnswer === 'hides' ? '✅ Correct! Bar chart HIDES spatial conflicts.' : '❌ Bar chart only shows TIME, not LOCATION.'}
                </div>
              )}
            </div>
            {phaseBSubmitted && (
              <button onClick={nextPhase} className="w-full py-4 bg-yellow-500 text-white rounded-lg font-bold text-lg">🔍 Reveal the Truth →</button>
            )}
          </>
        )}
        
        {/* PHASE C: LOB Revelation */}
        {phase === 'C' && (
          <>
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
              <h3 className="font-bold text-xl">🎬 Introducing: Line of Balance (LOB)</h3>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 bg-gray-50 rounded"><strong>Bar Chart:</strong> Shows WHEN (time only)</div>
                <div className="p-3 bg-blue-50 rounded"><strong>LOB:</strong> Shows WHEN + WHERE (time + location)</div>
              </div>
              <div className="flex justify-center gap-4 mb-4">
                {['Bar Chart', 'Transform', 'LOB View'].map((l, i) => (
                  <button key={i} onClick={() => setAnimStep(i)} className={`px-4 py-2 rounded ${animStep === i ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>{l}</button>
                ))}
              </div>
              {animStep === 0 && (
                <div className="p-4 bg-gray-50 rounded">
                  {[{ n: 'Excavation', c: 'bg-blue-500' }, { n: 'Pipe Laying', c: 'bg-green-500' }, { n: 'Backfill', c: 'bg-orange-500' }].map((b, i) => (
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <span className="w-24 text-sm text-right">{b.n}</span>
                      <div className="flex-1 h-5 bg-gray-200 rounded relative">
                        <div className={`absolute h-full ${b.c} rounded`} style={{ left: '12.5%', width: '60%' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {animStep === 1 && <div className="p-8 bg-yellow-50 rounded text-center"><p className="text-4xl">🔄</p><p className="font-bold">Y-axis becomes DISTANCE...</p></div>}
              {animStep === 2 && (
                <>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={lobDataNaive} margin={{ top: 10, right: 30, bottom: 30, left: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" label={{ value: 'Time (days)', position: 'insideBottom', offset: -5 }} />
                      <YAxis domain={[0, PROJECT_LENGTH]} tickFormatter={v => (v/1000).toFixed(0) + 'k'} />
                      <Tooltip />
                      <Legend />
                      {conflictInfo && <ReferenceLine x={conflictInfo.day} stroke="red" strokeWidth={2} strokeDasharray="5 5" />}
                      <Line type="linear" dataKey="exc0" stroke="#2563eb" strokeWidth={3} name="Excavation" dot={false} />
                      <Line type="linear" dataKey="pipe0" stroke="#16a34a" strokeWidth={3} name="Pipe Laying" dot={false} />
                      <Line type="linear" dataKey="back0" stroke="#ea580c" strokeWidth={3} name="Backfill" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="mt-4 p-4 bg-red-100 border-2 border-red-500 rounded animate-pulse">
                    <h5 className="font-bold text-red-800">😱 LINES CROSS at Day {conflictInfo?.day}!</h5>
                    <p className="text-red-700">Backfill catches up to Pipe Laying - IMPOSSIBLE in real construction!</p>
                  </div>
                </>
              )}
            </div>
            {animStep === 2 && <button onClick={nextPhase} className="w-full py-4 bg-red-600 text-white rounded-lg font-bold text-lg">🔍 Explore the Conflict →</button>}
          </>
        )}
        
        {/* PHASE D: Conflict Explorer */}
        {phase === 'D' && (
          <>
            <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded">
              <h3 className="font-bold text-xl">🔍 Explore the Conflict</h3>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <div className="flex items-center gap-4 mb-4">
                <span className="font-bold">Day:</span>
                <input type="range" min={15} max={naiveSchedule.end} value={viewDay} onChange={e => setViewDay(parseInt(e.target.value))} className="flex-1" />
                <span className="font-bold text-lg w-16">{viewDay}</span>
              </div>
              <div className="flex gap-2 mb-4">
                {[30, conflictInfo?.day || 45, 60].map(d => (
                  <button key={d} onClick={() => setViewDay(d)} className={`px-3 py-1 rounded text-sm ${d === conflictInfo?.day ? 'bg-red-200' : 'bg-gray-200'}`}>
                    Day {d} {d === conflictInfo?.day && '⚠️'}
                  </button>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={lobDataNaive} margin={{ top: 10, right: 30, bottom: 20, left: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis domain={[0, PROJECT_LENGTH]} tickFormatter={v => (v/1000).toFixed(0) + 'k'} />
                  <ReferenceLine x={viewDay} stroke="#9333ea" strokeWidth={2} />
                  <Line type="linear" dataKey="exc0" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line type="linear" dataKey="pipe0" stroke="#16a34a" strokeWidth={2} dot={false} />
                  <Line type="linear" dataKey="back0" stroke="#ea580c" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <h4 className="font-bold mb-3">📍 Status at Day {viewDay}</h4>
              {[{ n: 'Excavation', i: '⛏️', c: 'bg-blue-500', p: positions.exc },
                { n: 'Pipe Laying', i: '🔧', c: 'bg-green-500', p: positions.pipe },
                { n: 'Backfill', i: '🚜', c: 'bg-orange-500', p: positions.back }].map((cr, idx) => (
                <div key={idx} className="mb-2">
                  <div className="flex justify-between text-sm">{cr.i} {cr.n}<span>{cr.p.toLocaleString()} ft</span></div>
                  <div className="h-3 bg-gray-100 rounded"><div className={`h-full ${cr.c} rounded-l`} style={{ width: `${(cr.p / PROJECT_LENGTH) * 100}%` }} /></div>
                </div>
              ))}
              <div className={`mt-4 p-3 rounded ${hasConflict ? 'bg-red-100 border-2 border-red-500' : 'bg-green-100 border border-green-500'}`}>
                {hasConflict ? <><strong className="text-red-800">❌ CONFLICT!</strong> Backfill ahead of Pipe Laying!</> : <strong className="text-green-800">✅ No conflict yet</strong>}
              </div>
            </div>
            <button onClick={nextPhase} className="w-full py-4 bg-purple-600 text-white rounded-lg font-bold text-lg">I understand → Continue</button>
          </>
        )}
        
        {/* PHASE E: Compare R1 vs Naive */}
        {phase === 'E' && (
          <>
            <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
              <h3 className="font-bold text-xl">⚖️ Compare: Your R1 vs Naive</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg shadow p-4">
                <h4 className="font-bold text-red-600 mb-2">❌ Naive</h4>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={lobDataNaive} margin={{ top: 5, right: 5, bottom: 5, left: 30 }}>
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, PROJECT_LENGTH]} tick={{ fontSize: 10 }} tickFormatter={v => (v/1000).toFixed(0)} />
                    <Line type="linear" dataKey="exc0" stroke="#2563eb" strokeWidth={2} dot={false} />
                    <Line type="linear" dataKey="pipe0" stroke="#16a34a" strokeWidth={2} dot={false} />
                    <Line type="linear" dataKey="back0" stroke="#ea580c" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-center text-red-600 font-bold">Lines CROSS ❌</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <h4 className="font-bold text-green-600 mb-2">✅ Your R1</h4>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={lobDataR1} margin={{ top: 5, right: 5, bottom: 5, left: 30 }}>
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, PROJECT_LENGTH]} tick={{ fontSize: 10 }} tickFormatter={v => (v/1000).toFixed(0)} />
                    <Line type="linear" dataKey="exc0" stroke="#2563eb" strokeWidth={2} dot={false} />
                    <Line type="linear" dataKey="pipe0" stroke="#16a34a" strokeWidth={2} dot={false} />
                    <Line type="linear" dataKey="back0" stroke="#ea580c" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-center text-green-600 font-bold">Parallel ✅</p>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <h4 className="font-bold mb-2">💡 Insight</h4>
              <p>You delayed crews to avoid conflicts. But through <strong>trial-and-error</strong>. Let's learn the MATH!</p>
            </div>
            <button onClick={nextPhase} className="w-full py-4 bg-green-600 text-white rounded-lg font-bold text-lg">Learn Buffer Calculations →</button>
          </>
        )}
        
        {/* PHASE F: Why Speeds Matter */}
        {phase === 'F' && (
          <>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <h3 className="font-bold text-xl">🏃 Why Speeds Matter</h3>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <div className="p-4 bg-gray-50 rounded mb-4">
                <p><strong>Runner A:</strong> 10 m/s (slower) | <strong>Runner B:</strong> 15 m/s (faster)</p>
                <p className="mt-2">If they start together → <strong>B pulls ahead!</strong></p>
              </div>
              <div className="p-4 bg-orange-50 rounded">
                <p><strong>In construction:</strong> If faster crew must FOLLOW slower → it will CATCH UP! 💥</p>
                <p className="mt-2">Solution: <strong>Delay the faster crew's start.</strong></p>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <p className="font-bold mb-3">Quiz: Crew A (200 ft/day) → Crew B (150 ft/day follows). What happens?</p>
              {['catches', 'ahead', 'same'].map(v => (
                <button key={v} onClick={() => !phaseFSubmitted && setPhaseFAnswer(v)} disabled={phaseFSubmitted}
                  className={`block w-full p-3 rounded border-2 text-left mb-2 ${
                    !phaseFSubmitted ? (phaseFAnswer === v ? 'border-blue-500 bg-blue-50' : 'border-gray-200')
                    : (v === 'ahead' ? 'border-green-500 bg-green-50' : (phaseFAnswer === v ? 'border-red-500 bg-red-50' : 'opacity-50'))
                  }`}>
                  {v === 'catches' ? 'B catches up (conflict!)' : v === 'ahead' ? 'A pulls ahead (no conflict)' : 'They stay same distance'}
                </button>
              ))}
              {!phaseFSubmitted && phaseFAnswer && <button onClick={() => setPhaseFSubmitted(true)} className="px-6 py-2 bg-blue-600 text-white rounded font-bold">Check</button>}
              {phaseFSubmitted && <div className="p-4 bg-green-100 rounded text-green-800">✅ A pulls ahead! A (200) is faster than B (150). SAFE!</div>}
            </div>
            {phaseFSubmitted && <button onClick={nextPhase} className="w-full py-4 bg-blue-600 text-white rounded-lg font-bold text-lg">Continue to Buffer Types →</button>}
          </>
        )}
        
        {/* PHASE G: Buffer Types */}
        {phase === 'G' && (
          <>
            <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded">
              <h3 className="font-bold text-xl">📚 Two Types of Buffers</h3>
            </div>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="flex border-b">
                <button onClick={() => setBufferTab('simple')} className={`flex-1 py-3 font-bold ${bufferTab === 'simple' ? 'bg-blue-100 text-blue-800 border-b-2 border-blue-500' : 'bg-gray-50'}`}>Simple Buffer</button>
                <button onClick={() => setBufferTab('delayed')} className={`flex-1 py-3 font-bold ${bufferTab === 'delayed' ? 'bg-orange-100 text-orange-800 border-b-2 border-orange-500' : 'bg-gray-50'}`}>Delayed Buffer</button>
              </div>
              {bufferTab === 'simple' && (
                <div className="p-5">
                  <div className="bg-blue-50 p-4 rounded mb-4">
                    <h4 className="font-bold text-blue-800">SIMPLE BUFFER</h4>
                    <p><strong>When:</strong> Following crew is SLOWER</p>
                    <div className="mt-2 p-2 bg-white rounded border border-blue-300 font-mono text-center">Start_B = Start_A + Buffer</div>
                  </div>
                  <p className="p-3 bg-blue-100 rounded">Example: Exc Start=15, Buffer=5 → Pipe Start = 15 + 5 = <strong>20</strong></p>
                </div>
              )}
              {bufferTab === 'delayed' && (
                <div className="p-5">
                  <div className="bg-orange-50 p-4 rounded mb-4">
                    <h4 className="font-bold text-orange-800">DELAYED BUFFER</h4>
                    <p><strong>When:</strong> Following crew is FASTER</p>
                    <div className="mt-2 p-2 bg-white rounded border border-orange-300 font-mono text-center">Start_B = End_A + Buffer - Duration_B + 1</div>
                  </div>
                  <p className="p-3 bg-orange-100 rounded">Example: Pipe End=107, Buffer=5, Back Dur=64 → Back Start = 107 + 5 - 64 + 1 = <strong>49</strong></p>
                </div>
              )}
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <div className="flex gap-4">
                <div className="flex-1 p-3 bg-blue-100 rounded text-center"><strong>SLOWER</strong> → Simple Buffer</div>
                <div className="flex-1 p-3 bg-orange-100 rounded text-center"><strong>FASTER</strong> → Delayed Buffer</div>
              </div>
            </div>
            <button onClick={nextPhase} className="w-full py-4 bg-purple-600 text-white rounded-lg font-bold text-lg">Practice Quiz →</button>
          </>
        )}
        
        {/* PHASE H: Buffer Quiz */}
        {phase === 'H' && (
          <>
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
              <h3 className="font-bold text-xl">🎯 Buffer Type Quiz</h3>
            </div>
            {[
              { id: 'q1', q: 'Excavation (220) → Pipe (180). Which buffer?', correct: 'simple', reason: 'Pipe is SLOWER → Simple' },
              { id: 'q2', q: 'Pipe (180) → Backfill (250). Which buffer?', correct: 'delayed', reason: 'Backfill is FASTER → Delayed' },
              { id: 'q3', q: 'X (300) → Y (200). Which buffer?', correct: 'simple', reason: 'Y is SLOWER → Simple' }
            ].map((qu, idx) => (
              <div key={qu.id} className="bg-white rounded-lg shadow p-5">
                <p className="font-bold mb-3">Q{idx + 1}: {qu.q}</p>
                <div className="flex gap-4 mb-2">
                  {['simple', 'delayed'].map(opt => (
                    <button key={opt} onClick={() => !quizHSub[qu.id] && setQuizH(p => ({...p, [qu.id]: opt}))} disabled={quizHSub[qu.id]}
                      className={`flex-1 p-3 rounded border-2 capitalize ${
                        !quizHSub[qu.id] ? (quizH[qu.id] === opt ? 'border-blue-500 bg-blue-50' : 'border-gray-200')
                        : (opt === qu.correct ? 'border-green-500 bg-green-50' : (quizH[qu.id] === opt ? 'border-red-500 bg-red-50' : 'opacity-50'))
                      }`}>{opt}</button>
                  ))}
                </div>
                {!quizHSub[qu.id] && quizH[qu.id] && <button onClick={() => setQuizHSub(p => ({...p, [qu.id]: true}))} className="px-4 py-2 bg-blue-600 text-white rounded">Check</button>}
                {quizHSub[qu.id] && <p className={`text-sm ${quizH[qu.id] === qu.correct ? 'text-green-600' : 'text-red-600'}`}>{quizH[qu.id] === qu.correct ? '✅' : '❌'} {qu.reason}</p>}
              </div>
            ))}
            {Object.values(quizHSub).every(Boolean) && <button onClick={nextPhase} className="w-full py-4 bg-yellow-500 text-white rounded-lg font-bold text-lg">Calculate Your Schedule →</button>}
          </>
        )}
        
        {/* PHASE I: Guided Calculation */}
        {phase === 'I' && (
          <>
            <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
              <h3 className="font-bold text-xl">🧮 Calculate Corrected Schedule (Buffer = 5)</h3>
            </div>
            {/* Step 1 */}
            <div className="bg-white rounded-lg shadow p-5">
              <h4 className="font-bold mb-2">Step 1: Excavation (Given)</h4>
              <div className="p-3 bg-blue-50 rounded">Start=15, Duration={DURATIONS.exc}, End=86</div>
              <div className="mt-2 flex items-center gap-4 p-3 bg-gray-100 rounded">
                ⛏️ Excavation: <span className="ml-auto">Start: <span className="bg-blue-200 px-2 rounded">15🔒</span> End: <span className="bg-blue-200 px-2 rounded">86🔒</span></span>
              </div>
              {calcStep === 1 && <button onClick={() => setCalcStep(2)} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded">Continue to Step 2 →</button>}
            </div>
            {/* Step 2 */}
            {calcStep >= 2 && (
              <div className="bg-white rounded-lg shadow p-5">
                <h4 className="font-bold mb-2">Step 2: Pipe Laying</h4>
                <div className="mb-4 p-3 bg-gray-50 rounded">
                  <p className="mb-2">Is Pipe (180) faster or slower than Excavation (220)?</p>
                  <div className="flex gap-4">
                    {['slower', 'faster'].map(opt => (
                      <button key={opt} onClick={() => !calcSub.s2a && setCalcAns(p => ({...p, s2a: opt}))} disabled={calcSub.s2a}
                        className={`flex-1 p-2 rounded border-2 capitalize ${
                          !calcSub.s2a ? (calcAns.s2a === opt ? 'border-blue-500 bg-blue-50' : 'border-gray-200')
                          : (opt === calcCorrect.s2a ? 'border-green-500 bg-green-50' : (calcAns.s2a === opt ? 'border-red-500 bg-red-50' : 'opacity-50'))
                        }`}>{opt}</button>
                    ))}
                  </div>
                  {!calcSub.s2a && calcAns.s2a && <button onClick={() => setCalcSub(p => ({...p, s2a: true}))} className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-sm">Check</button>}
                  {calcSub.s2a && <p className={`mt-2 text-sm ${calcAns.s2a === calcCorrect.s2a ? 'text-green-600' : 'text-red-600'}`}>{calcAns.s2a === calcCorrect.s2a ? '✅ Use Simple Buffer' : '❌ 180 < 220, so SLOWER'}</p>}
                </div>
                {calcSub.s2a && calcAns.s2a === calcCorrect.s2a && (
                  <div className="mb-4 p-3 bg-gray-50 rounded">
                    <p>Start = 15 + 5 = ?</p>
                    <div className="flex items-center gap-2 mt-2">
                      <input type="number" value={calcAns.s2b} onChange={e => setCalcAns(p => ({...p, s2b: e.target.value}))} disabled={calcSub.s2b}
                        className={`w-20 px-2 py-1 border-2 rounded text-center ${calcSub.s2b ? (parseInt(calcAns.s2b) === calcCorrect.s2b ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50') : 'border-gray-300'}`} placeholder="?" />
                      {!calcSub.s2b && calcAns.s2b && <button onClick={() => setCalcSub(p => ({...p, s2b: true}))} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Check</button>}
                    </div>
                    {calcSub.s2b && <p className={`mt-1 text-sm ${parseInt(calcAns.s2b) === calcCorrect.s2b ? 'text-green-600' : 'text-red-600'}`}>{parseInt(calcAns.s2b) === calcCorrect.s2b ? '✅ Start = 20' : '❌ Should be 20'}</p>}
                  </div>
                )}
                {calcSub.s2b && parseInt(calcAns.s2b) === calcCorrect.s2b && (
                  <div className="mb-4 p-3 bg-gray-50 rounded">
                    <p>End = 20 + {DURATIONS.pipe} - 1 = ?</p>
                    <div className="flex items-center gap-2 mt-2">
                      <input type="number" value={calcAns.s2c} onChange={e => setCalcAns(p => ({...p, s2c: e.target.value}))} disabled={calcSub.s2c}
                        className={`w-20 px-2 py-1 border-2 rounded text-center ${calcSub.s2c ? (parseInt(calcAns.s2c) === calcCorrect.s2c ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50') : 'border-gray-300'}`} placeholder="?" />
                      {!calcSub.s2c && calcAns.s2c && <button onClick={() => setCalcSub(p => ({...p, s2c: true}))} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Check</button>}
                    </div>
                    {calcSub.s2c && <p className={`mt-1 text-sm ${parseInt(calcAns.s2c) === calcCorrect.s2c ? 'text-green-600' : 'text-red-600'}`}>{parseInt(calcAns.s2c) === calcCorrect.s2c ? '✅ End = 107' : '❌ Should be 107'}</p>}
                  </div>
                )}
                {step2Done && (
                  <>
                    <div className="flex items-center gap-4 p-3 bg-green-100 rounded">🔧 Pipe Laying: <span className="ml-auto">Start: <span className="bg-green-200 px-2 rounded">20✓</span> End: <span className="bg-green-200 px-2 rounded">107✓</span></span></div>
                    {calcStep < 3 && <button onClick={() => setCalcStep(3)} className="mt-3 px-4 py-2 bg-green-600 text-white rounded">Continue to Step 3 →</button>}
                  </>
                )}
              </div>
            )}
            {/* Step 3 */}
            {calcStep >= 3 && (
              <div className="bg-white rounded-lg shadow p-5">
                <h4 className="font-bold mb-2">Step 3: Backfill</h4>
                <div className="mb-4 p-3 bg-gray-50 rounded">
                  <p className="mb-2">Is Backfill (250) faster or slower than Pipe (180)?</p>
                  <div className="flex gap-4">
                    {['slower', 'faster'].map(opt => (
                      <button key={opt} onClick={() => !calcSub.s3a && setCalcAns(p => ({...p, s3a: opt}))} disabled={calcSub.s3a}
                        className={`flex-1 p-2 rounded border-2 capitalize ${
                          !calcSub.s3a ? (calcAns.s3a === opt ? 'border-blue-500 bg-blue-50' : 'border-gray-200')
                          : (opt === calcCorrect.s3a ? 'border-green-500 bg-green-50' : (calcAns.s3a === opt ? 'border-red-500 bg-red-50' : 'opacity-50'))
                        }`}>{opt}</button>
                    ))}
                  </div>
                  {!calcSub.s3a && calcAns.s3a && <button onClick={() => setCalcSub(p => ({...p, s3a: true}))} className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-sm">Check</button>}
                  {calcSub.s3a && <p className={`mt-2 text-sm ${calcAns.s3a === calcCorrect.s3a ? 'text-green-600' : 'text-red-600'}`}>{calcAns.s3a === calcCorrect.s3a ? '✅ Use Delayed Buffer' : '❌ 250 > 180, so FASTER'}</p>}
                </div>
                {calcSub.s3a && calcAns.s3a === calcCorrect.s3a && (
                  <div className="mb-4 p-3 bg-gray-50 rounded">
                    <p>Start = 107 + 5 - {DURATIONS.back} + 1 = ?</p>
                    <div className="flex items-center gap-2 mt-2">
                      <input type="number" value={calcAns.s3b} onChange={e => setCalcAns(p => ({...p, s3b: e.target.value}))} disabled={calcSub.s3b}
                        className={`w-20 px-2 py-1 border-2 rounded text-center ${calcSub.s3b ? (parseInt(calcAns.s3b) === calcCorrect.s3b ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50') : 'border-gray-300'}`} placeholder="?" />
                      {!calcSub.s3b && calcAns.s3b && <button onClick={() => setCalcSub(p => ({...p, s3b: true}))} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Check</button>}
                    </div>
                    {calcSub.s3b && <p className={`mt-1 text-sm ${parseInt(calcAns.s3b) === calcCorrect.s3b ? 'text-green-600' : 'text-red-600'}`}>{parseInt(calcAns.s3b) === calcCorrect.s3b ? '✅ Start = 49' : '❌ Should be 49'}</p>}
                  </div>
                )}
                {calcSub.s3b && parseInt(calcAns.s3b) === calcCorrect.s3b && (
                  <div className="mb-4 p-3 bg-gray-50 rounded">
                    <p>End = 49 + {DURATIONS.back} - 1 = ?</p>
                    <div className="flex items-center gap-2 mt-2">
                      <input type="number" value={calcAns.s3c} onChange={e => setCalcAns(p => ({...p, s3c: e.target.value}))} disabled={calcSub.s3c}
                        className={`w-20 px-2 py-1 border-2 rounded text-center ${calcSub.s3c ? (parseInt(calcAns.s3c) === calcCorrect.s3c ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50') : 'border-gray-300'}`} placeholder="?" />
                      {!calcSub.s3c && calcAns.s3c && <button onClick={() => setCalcSub(p => ({...p, s3c: true}))} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Check</button>}
                    </div>
                    {calcSub.s3c && <p className={`mt-1 text-sm ${parseInt(calcAns.s3c) === calcCorrect.s3c ? 'text-green-600' : 'text-red-600'}`}>{parseInt(calcAns.s3c) === calcCorrect.s3c ? '✅ End = 112' : '❌ Should be 112'}</p>}
                  </div>
                )}
                {step3Done && <div className="flex items-center gap-4 p-3 bg-orange-100 rounded">🚜 Backfill: <span className="ml-auto">Start: <span className="bg-orange-200 px-2 rounded">49✓</span> End: <span className="bg-orange-200 px-2 rounded">112✓</span></span></div>}
              </div>
            )}
            {step2Done && step3Done && <button onClick={nextPhase} className="w-full py-4 bg-green-600 text-white rounded-lg font-bold text-lg">View Complete Schedule →</button>}
          </>
        )}
        
        {/* PHASE J: Final Schedule */}
        {phase === 'J' && (
          <>
            <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
              <h3 className="font-bold text-xl">✅ Corrected Schedule</h3>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <table className="w-full text-sm border mb-4">
                <thead className="bg-gray-100"><tr><th className="px-3 py-2 border">Activity</th><th className="px-3 py-2 border">Start</th><th className="px-3 py-2 border">End</th><th className="px-3 py-2 border">Buffer Type</th></tr></thead>
                <tbody>
                  <tr className="bg-blue-50"><td className="px-3 py-2 border">⛏️ Excavation</td><td className="px-3 py-2 border text-center font-bold">{correctedSchedule.excS}</td><td className="px-3 py-2 border text-center font-bold">{correctedSchedule.excE}</td><td className="px-3 py-2 border text-center">-</td></tr>
                  <tr className="bg-green-50"><td className="px-3 py-2 border">🔧 Pipe Laying</td><td className="px-3 py-2 border text-center font-bold">{correctedSchedule.pipeS}</td><td className="px-3 py-2 border text-center font-bold">{correctedSchedule.pipeE}</td><td className="px-3 py-2 border text-center text-blue-600">Simple</td></tr>
                  <tr className="bg-orange-50"><td className="px-3 py-2 border">🚜 Backfill</td><td className="px-3 py-2 border text-center font-bold">{correctedSchedule.backS}</td><td className="px-3 py-2 border text-center font-bold">{correctedSchedule.backE}</td><td className="px-3 py-2 border text-center text-orange-600">Delayed</td></tr>
                </tbody>
              </table>
              <div className="text-center p-3 bg-green-100 rounded">Duration: <strong className="text-2xl text-green-600">{correctedSchedule.end} days</strong></div>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <h4 className="font-bold mb-2">📈 LOB Chart</h4>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={lobDataCorrected} margin={{ top: 10, right: 30, bottom: 30, left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis domain={[0, PROJECT_LENGTH]} tickFormatter={v => (v/1000).toFixed(0) + 'k'} />
                  <Tooltip />
                  <Legend />
                  <Line type="linear" dataKey="exc0" stroke="#2563eb" strokeWidth={3} name="Excavation" dot={false} />
                  <Line type="linear" dataKey="pipe0" stroke="#16a34a" strokeWidth={3} name="Pipe Laying" dot={false} />
                  <Line type="linear" dataKey="back0" stroke="#ea580c" strokeWidth={3} name="Backfill" dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-4 p-4 bg-green-100 border-2 border-green-500 rounded">
                <strong className="text-green-800">✅ NO CROSSING!</strong> Lines stay parallel!
              </div>
            </div>
            <button onClick={nextPhase} className="w-full py-4 bg-green-600 text-white rounded-lg font-bold text-lg">Compare All Three →</button>
          </>
        )}
        
        {/* PHASE K: Three-Way Comparison */}
        {phase === 'K' && (
          <>
            <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded">
              <h3 className="font-bold text-xl">⚖️ Three-Way Comparison</h3>
            </div>
            <div className="bg-white rounded-lg shadow p-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-100"><th className="px-2 py-2 border"></th><th className="px-2 py-2 border text-red-600">❌ Naive</th><th className="px-2 py-2 border text-yellow-600">🤔 Your R1</th><th className="px-2 py-2 border text-green-600">✅ Calculated</th></tr></thead>
                <tbody>
                  <tr><td className="px-2 py-2 border font-bold">Duration</td><td className="px-2 py-2 border text-center">{naiveSchedule.end}d</td><td className="px-2 py-2 border text-center">{effectiveR1.end}d</td><td className="px-2 py-2 border text-center">{correctedSchedule.end}d</td></tr>
                  <tr><td className="px-2 py-2 border font-bold">Conflicts?</td><td className="px-2 py-2 border text-center text-red-600">YES❌</td><td className="px-2 py-2 border text-center text-green-600">NO✅</td><td className="px-2 py-2 border text-center text-green-600">NO✅</td></tr>
                  <tr><td className="px-2 py-2 border font-bold">Method</td><td className="px-2 py-2 border text-center">None</td><td className="px-2 py-2 border text-center">Guessing</td><td className="px-2 py-2 border text-center font-bold text-green-600">Formulas!</td></tr>
                </tbody>
              </table>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <div className="space-y-3">
                <div className="p-3 bg-red-50 rounded"><strong>Naive:</strong> Shortest but IMPOSSIBLE</div>
                <div className="p-3 bg-yellow-50 rounded"><strong>Your R1:</strong> Works, but trial-and-error doesn't scale</div>
                <div className="p-3 bg-green-50 rounded"><strong>Calculated:</strong> Works, repeatable, professional!</div>
              </div>
            </div>
            <button onClick={nextPhase} className="w-full py-4 bg-purple-600 text-white rounded-lg font-bold text-lg">Verify No Conflicts →</button>
          </>
        )}
        
        {/* PHASE L: Verify */}
        {phase === 'L' && (
          <>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <h3 className="font-bold text-xl">🔍 Verify: No Conflicts!</h3>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <div className="flex items-center gap-4 mb-4">
                <span>Day:</span>
                <input type="range" min={15} max={correctedSchedule.end} value={viewDay} onChange={e => setViewDay(parseInt(e.target.value))} className="flex-1" />
                <span className="font-bold w-16">{viewDay}</span>
              </div>
              <div className="flex gap-2 mb-4">
                {[20, 49, 75, 100, 112].map(d => (
                  <button key={d} onClick={() => setViewDay(d)} className={`px-3 py-1 rounded text-sm ${viewDay === d ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Day {d}</button>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={lobDataCorrected} margin={{ top: 10, right: 30, bottom: 20, left: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis domain={[0, PROJECT_LENGTH]} tickFormatter={v => (v/1000).toFixed(0) + 'k'} />
                  <ReferenceLine x={viewDay} stroke="#9333ea" strokeWidth={2} />
                  <Line type="linear" dataKey="exc0" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line type="linear" dataKey="pipe0" stroke="#16a34a" strokeWidth={2} dot={false} />
                  <Line type="linear" dataKey="back0" stroke="#ea580c" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              {[{ n: 'Excavation', i: '⛏️', c: 'bg-blue-500', p: positionsCorrected.exc },
                { n: 'Pipe Laying', i: '🔧', c: 'bg-green-500', p: positionsCorrected.pipe },
                { n: 'Backfill', i: '🚜', c: 'bg-orange-500', p: positionsCorrected.back }].map((cr, idx) => (
                <div key={idx} className="mb-2">
                  <div className="flex justify-between text-sm">{cr.i} {cr.n}<span>{cr.p.toLocaleString()} ft</span></div>
                  <div className="h-3 bg-gray-100 rounded"><div className={`h-full ${cr.c} rounded-l`} style={{ width: `${(cr.p / PROJECT_LENGTH) * 100}%` }} /></div>
                </div>
              ))}
              <div className="mt-4 p-4 bg-green-100 border-2 border-green-500 rounded">
                <strong className="text-green-800">✅ All Clear at Day {viewDay}!</strong>
                <p className="text-sm text-green-700 mt-1">Crews maintain proper sequence.</p>
              </div>
            </div>
            <button onClick={nextPhase} className="w-full py-4 bg-blue-600 text-white rounded-lg font-bold text-lg">Continue to Budget →</button>
          </>
        )}
        
        {/* PHASE M: Budget */}
        {phase === 'M' && (
          <>
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
              <h3 className="font-bold text-xl">💰 Budget Calculation</h3>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <table className="w-full text-sm border mb-4">
                <thead className="bg-gray-100"><tr><th className="px-3 py-2 border text-left">Item</th><th className="px-3 py-2 border text-right">Cost</th></tr></thead>
                <tbody>
                  <tr><td className="px-3 py-2 border">Mobilization</td><td className="px-3 py-2 border text-right">${MOB_COST.toLocaleString()}</td></tr>
                  <tr className="bg-blue-50"><td className="px-3 py-2 border">⛏️ Excavation ({DURATIONS.exc}d × $1,600)</td><td className="px-3 py-2 border text-right">${cost.excC.toLocaleString()}</td></tr>
                  <tr className="bg-green-50"><td className="px-3 py-2 border">🔧 Pipe Laying ({DURATIONS.pipe}d × $2,500)</td><td className="px-3 py-2 border text-right">${cost.pipeC.toLocaleString()}</td></tr>
                  <tr className="bg-orange-50"><td className="px-3 py-2 border">🚜 Backfill ({DURATIONS.back}d × $2,300)</td><td className="px-3 py-2 border text-right">${cost.backC.toLocaleString()}</td></tr>
                  <tr className="bg-gray-100 font-bold"><td className="px-3 py-2 border">Direct Total</td><td className="px-3 py-2 border text-right">${cost.direct.toLocaleString()}</td></tr>
                  <tr><td className="px-3 py-2 border">Indirect (30%)</td><td className="px-3 py-2 border text-right">${cost.indirect.toLocaleString()}</td></tr>
                  <tr><td className="px-3 py-2 border">Profit (5%)</td><td className="px-3 py-2 border text-right">${cost.profit.toLocaleString()}</td></tr>
                  <tr className="bg-green-100 font-bold text-lg"><td className="px-3 py-2 border">TOTAL</td><td className="px-3 py-2 border text-right">${cost.total.toLocaleString()}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 rounded text-center ${correctedSchedule.end <= TARGET_DAYS ? 'bg-green-100 border-2 border-green-500' : 'bg-red-100 border-2 border-red-500'}`}>
                  <div className="text-gray-600">Duration</div>
                  <div className={`text-2xl font-bold ${correctedSchedule.end <= TARGET_DAYS ? 'text-green-600' : 'text-red-600'}`}>{correctedSchedule.end}d</div>
                  <div className="text-sm">Target: ≤{TARGET_DAYS}d {correctedSchedule.end <= TARGET_DAYS ? '✅' : '❌'}</div>
                </div>
                <div className={`p-4 rounded text-center ${cost.total <= TARGET_COST ? 'bg-green-100 border-2 border-green-500' : 'bg-red-100 border-2 border-red-500'}`}>
                  <div className="text-gray-600">Cost</div>
                  <div className={`text-2xl font-bold ${cost.total <= TARGET_COST ? 'text-green-600' : 'text-red-600'}`}>${(cost.total/1000).toFixed(0)}K</div>
                  <div className="text-sm">Target: ≤${TARGET_COST/1000}K {cost.total <= TARGET_COST ? '✅' : '❌'}</div>
                </div>
              </div>
              <div className="mt-4 p-4 bg-yellow-100 rounded">
                <p className="text-yellow-800"><strong>⚠️ Valid schedule but exceeds targets!</strong> We'll optimize in R3-R5.</p>
              </div>
            </div>
            <button onClick={nextPhase} className="w-full py-4 bg-yellow-500 text-white rounded-lg font-bold text-lg">R2 Summary →</button>
          </>
        )}
        
        {/* PHASE N: Summary */}
        {phase === 'N' && (
          <>
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-lg">
              <h3 className="font-bold text-2xl">🎓 R2 Summary: What You Learned</h3>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <h4 className="font-bold mb-3">📚 Key Concept 1: LOB vs Bar Chart</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded"><strong>Bar Chart:</strong> WHEN only</div>
                <div className="p-3 bg-blue-50 rounded"><strong>LOB:</strong> WHEN + WHERE</div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <h4 className="font-bold mb-3">📚 Key Concept 2: Reading LOB</h4>
              <ul className="space-y-2">
                <li className="p-2 bg-gray-50 rounded"><strong>Slope</strong> = Production Rate</li>
                <li className="p-2 bg-red-50 rounded"><strong>Crossing</strong> = Conflict ❌</li>
                <li className="p-2 bg-green-50 rounded"><strong>Parallel</strong> = Good ✅</li>
              </ul>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <h4 className="font-bold mb-3">📚 Key Concept 3: Buffer Types</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-blue-50 rounded"><strong>Simple Buffer</strong><br/>When follower is SLOWER<br/><code className="text-xs">Start = Prev Start + Buffer</code></div>
                <div className="p-3 bg-orange-50 rounded"><strong>Delayed Buffer</strong><br/>When follower is FASTER<br/><code className="text-xs">Start = Prev End + Buffer - Dur + 1</code></div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <h4 className="font-bold mb-3">🔮 What's Next?</h4>
              <p className="mb-2">Schedule is VALID but exceeds targets. R3-R5 will optimize!</p>
              <ul className="space-y-1 text-sm">
                <li className="p-2 bg-gray-50 rounded"><strong>R3:</strong> Buffer Analysis</li>
                <li className="p-2 bg-gray-50 rounded"><strong>R4:</strong> Rate Analysis</li>
                <li className="p-2 bg-gray-50 rounded"><strong>R5:</strong> Optimization</li>
              </ul>
            </div>
            <button onClick={() => onComplete(correctedSchedule)} className="w-full py-4 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg font-bold text-lg">
              Complete R2 → Proceed to R3 🎉
            </button>
          </>
        )}
        
      </div>
    </div>
  );
}
