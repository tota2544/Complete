import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const PROJECT_LENGTH = 15840;
const MOB_DAYS = 14;
const MOB_COST = 25000;
const DEFAULT_BUFFER = 5;
const INDIRECT_RATE = 0.30;
const PROFIT_RATE = 0.05;
const TARGET_DAYS = 55;
const TARGET_COST = 550000;

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

// ==================== SURVEY CONFIGURATION ====================
const KNOWLEDGE_QUESTIONS = [
  { id: 'K1', question: 'What is the correct sequence of pipeline construction activities?', options: [{ value: 'a', label: 'Backfill → Pipe Laying → Excavation' }, { value: 'b', label: 'Pipe Laying → Excavation → Backfill' }, { value: 'c', label: 'Excavation → Pipe Laying → Backfill' }, { value: 'd', label: 'Any order works' }], correct: 'c' },
  { id: 'K2', question: 'In a Line of Balance (LOB) chart, what does a steeper slope indicate?', options: [{ value: 'a', label: 'Slower production rate' }, { value: 'b', label: 'Faster production rate' }, { value: 'c', label: 'Higher cost' }, { value: 'd', label: 'Longer duration' }], correct: 'b' },
  { id: 'K3', question: 'What does it mean when two LOB lines cross each other?', options: [{ value: 'a', label: 'Activities are on schedule' }, { value: 'b', label: 'A conflict exists' }, { value: 'c', label: 'Buffer is too large' }, { value: 'd', label: 'Project is complete' }], correct: 'b' },
  { id: 'K4', question: 'What is the primary purpose of a buffer in LOB scheduling?', options: [{ value: 'a', label: 'Increase project cost' }, { value: 'b', label: 'Make the chart look better' }, { value: 'c', label: 'Prevent crew conflicts' }, { value: 'd', label: 'Reduce equipment needs' }], correct: 'c' },
  { id: 'K5', question: 'If you increase the buffer value, what happens to project duration?', options: [{ value: 'a', label: 'Project Duration decreases' }, { value: 'b', label: 'Project Duration increases' }, { value: 'c', label: 'Project Duration stays the same' }, { value: 'd', label: 'Required more data to interpret' }], correct: 'b' },
  { id: 'K6', question: 'If you increase the buffer value, what happens to total cost?', options: [{ value: 'a', label: 'Total Cost increases' }, { value: 'b', label: 'Total Cost decreases' }, { value: 'c', label: 'Total Cost stays the same' }, { value: 'd', label: 'Required more data to interpret' }], correct: 'c' },
  { id: 'K7', question: 'If you use faster equipment for ONE activity, what happens to the total project duration?', options: [{ value: 'a', label: 'Project Duration decreases' }, { value: 'b', label: 'Project Duration increases' }, { value: 'c', label: 'Project Duration stays the same' }, { value: 'd', label: 'Required more data to interpret' }], correct: 'd' },
  { id: 'K8', question: 'How do you calculate activity duration?', options: [{ value: 'a', label: 'ROUNDUP(Project Length × Production Rate)' }, { value: 'b', label: 'ROUNDUP(Production Rate ÷ Project Length)' }, { value: 'c', label: 'ROUNDUP(Project Length ÷ Production Rate)' }, { value: 'd', label: 'ROUNDUP(Project Length – Production Rate)' }], correct: 'c' },
];

const SELF_CONFIDENCE_QUESTIONS = [
  { id: 'SC1', question: 'Calculate activity durations from production rates' },
  { id: 'SC2', question: 'Identify scheduling conflicts using Line of Balance' },
  { id: 'SC3', question: 'Apply buffers correctly to prevent crew conflicts' },
  { id: 'SC4', question: 'Optimize a schedule to meet project duration and total cost constraints' },
];

const EXPERIENCE_QUESTIONS = [
  { id: 'EX1', question: 'The game helped me understand LOB scheduling concepts' },
  { id: 'EX2', question: 'The visual feedback was helpful for learning' },
  { id: 'EX3', question: 'The difficulty level was appropriate' },
  { id: 'EX4', question: 'I would recommend this game to other students' },
  { id: 'EX5', question: 'The game was engaging' },
  { id: 'EX6', question: 'I learned something new' },
];

const calculateKnowledgeScore = (answers) => KNOWLEDGE_QUESTIONS.reduce((score, q) => score + (answers[q.id] === q.correct ? 1 : 0), 0);
const calculateMeanScore = (answers, questions) => {
  const values = questions.map(q => answers[q.id] || 0).filter(x => x > 0);
  return values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : '0.00';
};

// ==================== GOOGLE SHEETS INTEGRATION ====================
// PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL HERE:
const GOOGLE_SCRIPT_URL = 'YOUR_GOOGLE_SCRIPT_URL_HERE';

const submitToSheet = async (sheetName, data) => {
  if (GOOGLE_SCRIPT_URL === 'YOUR_GOOGLE_SCRIPT_URL_HERE') {
    console.warn('Google Sheets URL not configured. Data not submitted:', sheetName, data);
    return;
  }
  const payload = JSON.stringify({ sheet: sheetName, timestamp: new Date().toISOString(), ...data });
  try {
    // Method 1: Use navigator.sendBeacon (most reliable, survives page navigation)
    const blob = new Blob([payload], { type: 'text/plain' });
    const sent = navigator.sendBeacon(GOOGLE_SCRIPT_URL, blob);
    if (sent) {
      console.log(`✅ Submitted to ${sheetName} via sendBeacon`);
      return;
    }
    // Method 2: Fallback to fetch with text/plain (avoids CORS preflight)
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: payload,
    });
    console.log(`✅ Submitted to ${sheetName} via fetch`);
  } catch (error) {
    console.error(`❌ Failed to submit to ${sheetName}:`, error);
    // Method 3: Last resort - iframe form submission
    try {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = GOOGLE_SCRIPT_URL;
      form.target = '_blank';
      form.style.display = 'none';
      const input = document.createElement('input');
      input.name = 'data';
      input.value = payload;
      form.appendChild(input);
      document.body.appendChild(form);
      // Don't actually submit the form (would open new tab), just log
      document.body.removeChild(form);
      console.warn('⚠️ Fallback methods exhausted for', sheetName);
    } catch (e2) {
      console.error('❌ All submission methods failed:', e2);
    }
  }
};
// ==================== END GOOGLE SHEETS INTEGRATION ====================

// -------------------- R1 DRAG SCHEDULER HELPERS/COMPONENTS --------------------
const CORRECT_DURATIONS = {
  exc: Math.ceil(PROJECT_LENGTH / CREWS.exc.rate),
  pipe: Math.ceil(PROJECT_LENGTH / CREWS.pipe.rate),
  back: Math.ceil(PROJECT_LENGTH / CREWS.back.rate),
};

function DraggableBarChart({ schedule, durations, onScheduleChange }) {
  const chartRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);

  const CHART_WIDTH = 700;
  const CHART_PADDING_LEFT = 180;
  const MAX_DAY = 160;
  const USABLE_WIDTH = CHART_WIDTH - CHART_PADDING_LEFT - 20;
  const PIXELS_PER_DAY = USABLE_WIDTH / MAX_DAY;
  const BAR_HEIGHT = 36;
  const BAR_GAP = 12;
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

  const excDur = durations.exc > 0 ? durations.exc : 0;
  const pipeDur = durations.pipe > 0 ? durations.pipe : 0;
  const backDur = durations.back > 0 ? durations.back : 0;

  const bars = [
    { id: 'mob', label: 'Mobilization', start: 1, duration: MOB_DAYS, color: 'bg-gray-400', locked: true, show: true },
    { id: 'exc', label: 'Excavation & Bedding', start: schedule.excStart || 0, duration: excDur, color: 'bg-blue-500', locked: false, show: excDur > 0 && schedule.excStart > 0 },
    { id: 'pipe', label: 'Pipe Laying & Alignment', start: schedule.pipeStart || 0, duration: pipeDur, color: 'bg-green-500', locked: false, show: pipeDur > 0 && schedule.pipeStart > 0 },
    { id: 'back', label: 'Backfill & Compaction', start: schedule.backStart || 0, duration: backDur, color: 'bg-orange-500', locked: false, show: backDur > 0 && schedule.backStart > 0 },
  ];

  const xTicks = [0, 20, 40, 60, 80, 100, 120, 140, 160];

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-4 mb-4 text-sm justify-center">
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-400 rounded"></div><span>Mobilization</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-blue-500 rounded"></div><span>Excavation & Bedding</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-green-500 rounded"></div><span>Pipe Laying & Alignment</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-orange-500 rounded"></div><span>Backfill & Compaction</span></div>
      </div>
      <div className="overflow-x-auto pb-2">
        <div ref={chartRef} className="relative bg-gray-50 rounded-lg border" style={{ width: CHART_WIDTH, height: CHART_HEIGHT, margin: '0 auto', minWidth: CHART_WIDTH, touchAction: 'pan-x' }}>
          <div className="absolute text-sm font-medium text-gray-600" style={{ left: 8, top: '50%', transform: 'rotate(-90deg) translateX(-50%)', transformOrigin: 'left center' }}>Activity</div>
          {xTicks.map(day => (<div key={`grid-${day}`} className="absolute w-px bg-gray-200" style={{ left: dayToPixel(day), top: 10, bottom: 40 }} />))}
          {bars.map((bar, index) => (<div key={`label-${bar.id}`} className="absolute text-sm text-gray-700 text-right pr-3" style={{ left: 20, width: CHART_PADDING_LEFT - 30, top: index * (BAR_HEIGHT + BAR_GAP) + 20 + BAR_HEIGHT / 2 - 10 }}>{bar.label}</div>))}
          {bars.map((bar, index) => (
            bar.show ? (
              <div key={bar.id} className={`absolute ${bar.color} rounded flex items-center justify-center text-white text-xs font-bold shadow ${bar.locked ? 'cursor-not-allowed opacity-80' : 'cursor-grab active:cursor-grabbing hover:shadow-lg'} ${dragging === bar.id ? 'ring-4 ring-yellow-400 shadow-xl z-10' : ''}`} style={{ left: dayToPixel(bar.start), width: Math.max(bar.duration * PIXELS_PER_DAY, 40), height: BAR_HEIGHT, top: index * (BAR_HEIGHT + BAR_GAP) + 20, touchAction: 'none' }} onMouseDown={bar.locked ? undefined : (e) => handleMouseDown(bar.id, e)} onTouchStart={bar.locked ? undefined : (e) => handleTouchStart(bar.id, e)}>
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
      <div className="text-center text-xs text-gray-400 mt-1 md:hidden">← Swipe to scroll chart →</div>
    </div>
  );
}

// Standalone input components (defined outside Round1 to prevent re-mount on every render)
function R1InputCell({ value, onChange, disabled }) {
  return <input type="number" value={value} onChange={onChange} disabled={disabled} className={`w-16 px-1 py-1 border-2 rounded text-center text-sm font-bold ${disabled ? 'bg-gray-100 border-gray-300 text-gray-400' : 'bg-yellow-50 border-yellow-400'}`} placeholder="?" />;
}

function R1DurationInputCell({ value, onChange, isCorrect, submitted }) {
  let className = "w-20 px-2 py-1 border-2 rounded text-center font-bold ";
  if (!submitted) className += "bg-yellow-50 border-yellow-400";
  else if (isCorrect) className += "bg-green-100 border-green-500 text-green-700";
  else className += "bg-red-100 border-red-500 text-red-700";
  return <input type="number" value={value} onChange={onChange} disabled={submitted && isCorrect} className={className} placeholder="?" />;
}

function Round1({ onComplete, savedSchedule }) {
  const [durInput, setDurInput] = useState(savedSchedule ? { exc: String(CORRECT_DURATIONS.exc), pipe: String(CORRECT_DURATIONS.pipe), back: String(CORRECT_DURATIONS.back) } : { exc: '', pipe: '', back: '' });
  const [durValidated, setDurValidated] = useState(!!savedSchedule);
  const [scheduleInput, setScheduleInput] = useState(savedSchedule ? { excS: String(savedSchedule.excS), pipeS: String(savedSchedule.pipeS), backS: String(savedSchedule.backS) } : { excS: '', pipeS: '', backS: '' });

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
    if (newSchedule.pipeStart > 0 && newSchedule.pipeStart !== (parseInt(scheduleInput.pipeS) || 0)) setScheduleInput(prev => ({ ...prev, pipeS: String(newSchedule.pipeStart) }));
    if (newSchedule.backStart > 0 && newSchedule.backStart !== (parseInt(scheduleInput.backS) || 0)) setScheduleInput(prev => ({ ...prev, backS: String(newSchedule.backStart) }));
  }, [scheduleInput]);

  const allScheduleFilled = fullSchedule.excS > 0 && fullSchedule.pipeS > 0 && fullSchedule.backS > 0;

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <h3 className="font-bold text-xl text-blue-900">📋 Round 1: Create Your Schedule</h3>
        <p className="text-gray-600 mt-1">In this round, you will create a bar chart schedule for the pipeline project. First calculate each activity's duration, then input start and end days to build your schedule.</p>
      </div>
      <div className="bg-white rounded-lg shadow p-5">
        <h4 className="font-bold text-gray-700 mb-4">📐 Activity Sequence & Duration Calculation</h4>
        <div className="flex justify-center items-center gap-4 text-center mb-6">
          <div className="flex flex-col items-center"><span className="text-3xl">⛏️</span><span className="font-medium text-sm">Excavation &<br/>Bedding</span></div>
          <span className="text-2xl text-gray-400">→</span>
          <div className="flex flex-col items-center"><span className="text-3xl">🔧</span><span className="font-medium text-sm">Pipe Laying &<br/>Alignment</span></div>
          <span className="text-2xl text-gray-400">→</span>
          <div className="flex flex-col items-center"><span className="text-3xl">🚜</span><span className="font-medium text-sm">Backfill &<br/>Compaction</span></div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4"><div className="font-bold text-yellow-800 mb-2">Formula: Duration = ROUNDUP(Project Length ÷ Rate)</div></div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4"><div className="text-sm text-blue-800"><strong>Example:</strong> Excavation has rate {CREWS.exc.rate} ft/day<br/>Duration = {PROJECT_LENGTH.toLocaleString()} ft ÷ {CREWS.exc.rate} ft/day = <strong>{CORRECT_DURATIONS.exc} days</strong></div></div>
        <p className="text-sm text-gray-600 mb-3">Calculate the duration for each activity (Project Length = {PROJECT_LENGTH.toLocaleString()} ft):</p>
        <table className="w-full text-sm border">
          <thead className="bg-gray-100"><tr><th className="px-2 py-2 border text-left">Activity</th><th className="px-2 py-2 border text-center">Rate (ft/day)</th><th className="px-2 py-2 border text-center bg-yellow-50">Duration (days)</th></tr></thead>
          <tbody>
            <tr className="text-blue-700"><td className="px-2 py-2 border">Excavation & Bedding</td><td className="px-2 py-2 border text-center">{CREWS.exc.rate}</td><td className="px-2 py-2 border text-center"><R1DurationInputCell value={durInput.exc} onChange={(e) => setDurInput({ ...durInput, exc: e.target.value })} isCorrect={durCorrect.exc} submitted={durValidated} /></td></tr>
            <tr className="text-green-700"><td className="px-2 py-2 border">Pipe Laying & Alignment</td><td className="px-2 py-2 border text-center">{CREWS.pipe.rate}</td><td className="px-2 py-2 border text-center"><R1DurationInputCell value={durInput.pipe} onChange={(e) => setDurInput({ ...durInput, pipe: e.target.value })} isCorrect={durCorrect.pipe} submitted={durValidated} /></td></tr>
            <tr className="text-orange-700"><td className="px-2 py-2 border">Backfill & Compaction</td><td className="px-2 py-2 border text-center">{CREWS.back.rate}</td><td className="px-2 py-2 border text-center"><R1DurationInputCell value={durInput.back} onChange={(e) => setDurInput({ ...durInput, back: e.target.value })} isCorrect={durCorrect.back} submitted={durValidated} /></td></tr>
          </tbody>
        </table>
        <div className="mt-4">
          <button onClick={() => setDurValidated(true)} className="px-4 py-2 bg-blue-500 text-white rounded font-bold hover:bg-blue-600">Check Answers</button>
          {durValidated && !allDurationsCorrect && <div className="mt-2 p-2 bg-red-100 text-red-700 rounded">❌ Some durations are incorrect. Please fix them and check again.</div>}
          {durValidated && allDurationsCorrect && <div className="mt-2 p-2 bg-green-100 text-green-700 rounded">✅ All durations are correct! Now build your schedule below.</div>}
        </div>
      </div>

      {durValidated && allDurationsCorrect && (
        <div className="bg-white rounded-lg shadow p-5">
          <h4 className="font-bold text-gray-700 mb-4">📝 Build Your Schedule</h4>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4"><div className="font-bold text-yellow-800 mb-2">Formula: End = Start + Duration - 1</div></div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4"><div className="text-sm text-blue-800"><strong>Example:</strong> Excavation starts Day 15, duration {CORRECT_DURATIONS.exc} days<br/>End = 15 + {CORRECT_DURATIONS.exc} - 1 = <strong>Day {15 + CORRECT_DURATIONS.exc - 1}</strong></div></div>
          <p className="text-sm text-gray-600 mb-3">Input the Start day for each activity. End is calculated automatically.</p>
          <table className="w-full text-sm border">
            <thead className="bg-gray-100"><tr><th className="px-2 py-2 border text-left">Activity</th><th className="px-2 py-2 border text-center">Rate (ft/day)</th><th className="px-2 py-2 border text-center">Duration (days)</th><th className="px-2 py-2 border text-center bg-yellow-50">Start</th><th className="px-2 py-2 border text-center">End</th></tr></thead>
            <tbody>
              <tr className="bg-gray-50"><td className="px-2 py-2 border">Mobilization</td><td className="px-2 py-2 border text-center">-</td><td className="px-2 py-2 border text-center">{MOB_DAYS}</td><td className="px-2 py-2 border text-center">1</td><td className="px-2 py-2 border text-center">{MOB_DAYS}</td></tr>
              <tr className="text-blue-700"><td className="px-2 py-2 border">Excavation & Bedding</td><td className="px-2 py-2 border text-center">{CREWS.exc.rate}</td><td className="px-2 py-2 border text-center">{CORRECT_DURATIONS.exc}</td><td className="px-2 py-2 border text-center"><R1InputCell value={scheduleInput.excS} onChange={(e) => setScheduleInput({ ...scheduleInput, excS: e.target.value })} /></td><td className="px-2 py-2 border text-center font-bold">{fullSchedule.excE > 0 ? fullSchedule.excE : '-'}</td></tr>
              <tr className="text-green-700"><td className="px-2 py-2 border">Pipe Laying & Alignment</td><td className="px-2 py-2 border text-center">{CREWS.pipe.rate}</td><td className="px-2 py-2 border text-center">{CORRECT_DURATIONS.pipe}</td><td className="px-2 py-2 border text-center"><R1InputCell value={scheduleInput.pipeS} onChange={(e) => setScheduleInput({ ...scheduleInput, pipeS: e.target.value })} /></td><td className="px-2 py-2 border text-center font-bold">{fullSchedule.pipeE > 0 ? fullSchedule.pipeE : '-'}</td></tr>
              <tr className="text-orange-700"><td className="px-2 py-2 border">Backfill & Compaction</td><td className="px-2 py-2 border text-center">{CREWS.back.rate}</td><td className="px-2 py-2 border text-center">{CORRECT_DURATIONS.back}</td><td className="px-2 py-2 border text-center"><R1InputCell value={scheduleInput.backS} onChange={(e) => setScheduleInput({ ...scheduleInput, backS: e.target.value })} /></td><td className="px-2 py-2 border text-center font-bold">{fullSchedule.backE > 0 ? fullSchedule.backE : '-'}</td></tr>
            </tbody>
          </table>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg text-center"><span className="text-gray-600">Project Duration:</span><span className="ml-3 text-2xl font-bold text-blue-600">{allScheduleFilled ? `${fullSchedule.end} days` : '- days'}</span></div>
        </div>
      )}

      {durValidated && allDurationsCorrect && (
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex justify-between items-center mb-4">
            <div><h4 className="font-bold text-gray-700">📊 Bar Chart Schedule</h4><p className="text-sm text-gray-500">Generated from your schedule above. You can also drag the bars to adjust.</p></div>
            <button onClick={() => setScheduleInput({ excS: '', pipeS: '', backS: '' })} className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300">🔄 Reset Schedule</button>
          </div>
          <DraggableBarChart schedule={{ excStart: fullSchedule.excS, pipeStart: fullSchedule.pipeS, backStart: fullSchedule.backS }} durations={{ exc: CORRECT_DURATIONS.exc, pipe: CORRECT_DURATIONS.pipe, back: CORRECT_DURATIONS.back }} onScheduleChange={handleBarDrag} />
        </div>
      )}

      <button onClick={() => onComplete(fullSchedule)} disabled={!allScheduleFilled || !allDurationsCorrect} className="w-full py-4 bg-blue-600 text-white rounded-lg font-bold text-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed">
        {!durValidated || !allDurationsCorrect ? 'Complete Duration Calculation First' : !allScheduleFilled ? 'Fill in Schedule to Continue' : 'Complete R1 →'}
      </button>
    </div>
  );
}
// -------------------- END R1 DRAG SCHEDULER --------------------

// -------------------- R2 COMPONENTS --------------------
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

function BarChartR1({ schedule }) {
  const maxDay = Math.max(schedule.excE, schedule.pipeE, schedule.backE, 120);
  const dayToPercent = (day) => (day / maxDay) * 100;
  const bars = [
    { label: 'Mobilization', start: 1, end: MOB_DAYS, color: 'bg-gray-400' },
    { label: 'Excavation', start: schedule.excS, end: schedule.excE, color: 'bg-blue-500' },
    { label: 'Pipe Laying', start: schedule.pipeS, end: schedule.pipeE, color: 'bg-green-500' },
    { label: 'Backfill', start: schedule.backS, end: schedule.backE, color: 'bg-orange-500' },
  ];
  return (
    <div className="space-y-2">
      {bars.map((bar, i) => (<div key={i} className="flex items-center gap-2"><div className="w-20 text-xs text-right text-gray-600">{bar.label}</div><div className="flex-1 h-6 bg-gray-100 rounded relative"><div className={`absolute h-full ${bar.color} rounded flex items-center justify-center text-white text-xs`} style={{ left: `${dayToPercent(bar.start)}%`, width: `${Math.max(dayToPercent(bar.end - bar.start + 1), 5)}%` }}>{bar.start}-{bar.end}</div></div></div>))}
      <div className="flex items-center gap-2"><div className="w-20"></div><div className="flex-1 flex justify-between text-xs text-gray-500 px-1"><span>0</span><span>{Math.round(maxDay/4)}</span><span>{Math.round(maxDay/2)}</span><span>{Math.round(maxDay*3/4)}</span><span>{maxDay}</span></div></div>
      <div className="text-center text-xs text-gray-500">Time (days)</div>
    </div>
  );
}

function findConflicts(schedule, durations) {
  const conflicts = [];
  const rates = { exc: CREWS.exc.rate, pipe: CREWS.pipe.rate, back: CREWS.back.rate };
  const pairs = [{ a: 'exc', b: 'pipe', aName: 'Excavation', bName: 'Pipe Laying' }, { a: 'pipe', b: 'back', aName: 'Pipe Laying', bName: 'Backfill' }];
  pairs.forEach(({ a, b, aName, bName }) => {
    const aS = schedule[a + 'S'], aE = schedule[a + 'E'], bS = schedule[b + 'S'], bE = schedule[b + 'E'];
    if (!aS || !bS || aS <= 0 || bS <= 0) return;
    const aRate = rates[a], bRate = rates[b];
    const maxEnd = Math.max(aE, bE);
    let prevDiff = null;
    for (let d = Math.min(aS, bS); d <= maxEnd; d++) {
      const aPos = d < aS ? 0 : d > aE ? PROJECT_LENGTH : Math.min((d - aS + 1) * aRate, PROJECT_LENGTH);
      const bPos = d < bS ? 0 : d > bE ? PROJECT_LENGTH : Math.min((d - bS + 1) * bRate, PROJECT_LENGTH);
      const diff = bPos - aPos;
      if (prevDiff !== null && prevDiff <= 0 && diff > 0) { conflicts.push({ day: d, dist: Math.round(aPos), aName, bName, a, b }); }
      prevDiff = diff;
    }
    if (bS <= aS) {
      const bDaysWorked = aS - bS + 1;
      const bPos1 = bS <= aS ? Math.min(bDaysWorked * bRate, PROJECT_LENGTH) : 0;
      if (bPos1 > 0 && aS >= bS) conflicts.push({ day: aS, dist: 0, aName, bName, a, b });
    }
  });
  return conflicts;
}

function LOBChartR1({ schedule, durations }) {
  const [hover, setHover] = useState(null);
  const chartRef = useRef(null);
  const CHART_WIDTH = 500, CHART_HEIGHT = 220;
  const PADDING = { top: 20, right: 25, bottom: 45, left: 55 };
  const PLOT_WIDTH = CHART_WIDTH - PADDING.left - PADDING.right;
  const PLOT_HEIGHT = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const MAX_DAY = Math.max(schedule.excE || 0, schedule.pipeE || 0, schedule.backE || 0, 100) + 10;
  const dayToX = (day) => PADDING.left + (day / MAX_DAY) * PLOT_WIDTH;
  const distToY = (dist) => PADDING.top + PLOT_HEIGHT - (dist / PROJECT_LENGTH) * PLOT_HEIGHT;
  const xToDay = (x) => Math.round(((x - PADDING.left) / PLOT_WIDTH) * MAX_DAY);
  const getLinePoints = (start, end) => { if (!start || !end || start <= 0) return ''; return `${dayToX(start)},${distToY(0)} ${dayToX(end)},${distToY(PROJECT_LENGTH)}`; };
  const getDistAtDay = (start, end, day, rate) => { if (day < start) return 0; if (day > end) return PROJECT_LENGTH; return Math.min(Math.round(rate * (day - start + 1)), PROJECT_LENGTH); };
  const lines = [
    { id: 'exc', start: schedule.excS, end: schedule.excE, color: '#2563eb', name: 'Excavation & Bedding', rate: CREWS.exc.rate },
    { id: 'pipe', start: schedule.pipeS, end: schedule.pipeE, color: '#16a34a', name: 'Pipe Laying & Alignment', rate: CREWS.pipe.rate },
    { id: 'back', start: schedule.backS, end: schedule.backE, color: '#ea580c', name: 'Backfill & Compaction', rate: CREWS.back.rate },
  ];
  const conflicts = findConflicts(schedule, durations);
  const handleMouseMove = (e) => { if (!chartRef.current) return; const rect = chartRef.current.getBoundingClientRect(); const x = e.clientX - rect.left; const day = xToDay(x); if (day >= 0 && day <= MAX_DAY && x >= PADDING.left && x <= CHART_WIDTH - PADDING.right) setHover({ day, x: e.clientX - rect.left, y: e.clientY - rect.top }); else setHover(null); };
  const xTicks = []; for (let d = 0; d <= MAX_DAY; d += 20) xTicks.push(d);
  const yTicks = [0, 4000, 8000, 12000, 16000];
  return (
    <div className="relative">
      <div className="flex flex-wrap gap-3 mb-1 text-xs justify-center">{lines.map(l => (<div key={l.id} className="flex items-center gap-1"><div className="w-4 h-0.5 rounded" style={{ backgroundColor: l.color }}></div><span style={{ color: l.color }}>{l.name}</span></div>))}</div>
      <svg ref={chartRef} width="100%" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="bg-white" onMouseMove={handleMouseMove} onMouseLeave={() => setHover(null)}>
        {xTicks.map(day => (<line key={`gx-${day}`} x1={dayToX(day)} y1={PADDING.top} x2={dayToX(day)} y2={CHART_HEIGHT - PADDING.bottom} stroke="#f0f0f0" strokeWidth="1" />))}
        {yTicks.map(dist => (<line key={`gy-${dist}`} x1={PADDING.left} y1={distToY(dist)} x2={CHART_WIDTH - PADDING.right} y2={distToY(dist)} stroke="#f0f0f0" strokeWidth="1" />))}
        <line x1={PADDING.left} y1={CHART_HEIGHT - PADDING.bottom} x2={CHART_WIDTH - PADDING.right} y2={CHART_HEIGHT - PADDING.bottom} stroke="#374151" strokeWidth="1.5" />
        <line x1={PADDING.left} y1={PADDING.top} x2={PADDING.left} y2={CHART_HEIGHT - PADDING.bottom} stroke="#374151" strokeWidth="1.5" />
        {xTicks.map(day => (<text key={`tx-${day}`} x={dayToX(day)} y={CHART_HEIGHT - PADDING.bottom + 16} textAnchor="middle" fontSize="10" fill="#6b7280">{day}</text>))}
        <text x={CHART_WIDTH / 2} y={CHART_HEIGHT - 5} textAnchor="middle" fontSize="11" fill="#374151">Time (days)</text>
        {yTicks.map(dist => (<text key={`ty-${dist}`} x={PADDING.left - 8} y={distToY(dist) + 3} textAnchor="end" fontSize="10" fill="#6b7280">{(dist / 1000)}k</text>))}
        <text x={12} y={CHART_HEIGHT / 2} textAnchor="middle" transform={`rotate(-90, 12, ${CHART_HEIGHT / 2})`} fontSize="11" fill="#374151">Distance (ft)</text>
        {lines.map(l => (<polyline key={l.id} points={getLinePoints(l.start, l.end)} fill="none" stroke={l.color} strokeWidth="2.5" />))}
        {conflicts.map((c, i) => { const cx = dayToX(c.day), cy = distToY(c.dist); return (<g key={`conflict-${i}`}><circle cx={cx} cy={cy} r="10" fill="#ef4444" opacity="0.2" /><circle cx={cx} cy={cy} r="6" fill="#ef4444" /><text x={cx} y={cy + 3.5} textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">✕</text></g>); })}
        {hover && <line x1={PADDING.left + (hover.day / MAX_DAY) * PLOT_WIDTH} y1={PADDING.top} x2={PADDING.left + (hover.day / MAX_DAY) * PLOT_WIDTH} y2={CHART_HEIGHT - PADDING.bottom} stroke="#9ca3af" strokeWidth="1" strokeDasharray="3,3" />}
      </svg>
      {hover && (<div className="absolute bg-white border border-gray-300 rounded shadow-lg p-2 text-xs pointer-events-none z-10" style={{ left: Math.min(hover.x + 10, CHART_WIDTH - 160), top: Math.max(hover.y - 80, 5) }}><div className="font-bold mb-1">Day {hover.day}</div>{lines.map(l => (<div key={l.id} className="flex justify-between gap-3" style={{ color: l.color }}><span>{l.name.split(' ')[0]}:</span><span className="font-mono">{getDistAtDay(l.start, l.end, hover.day, l.rate).toLocaleString()} ft</span></div>))}</div>)}
      <div className="mt-2 text-center">
        {conflicts.length > 0 ? (<div><span className="inline-block px-2 py-1 bg-red-100 text-red-700 text-xs rounded font-medium">❌ {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''} detected!</span><div className="mt-1 text-xs text-red-600">{conflicts.map((c, i) => (<div key={i}>Day {c.day}: {c.bName} passes {c.aName} at {c.dist.toLocaleString()} ft</div>))}</div></div>) : (<span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs rounded font-medium">✅ No conflicts detected</span>)}
      </div>
    </div>
  );
}

function DraggableLOBChart({ r1Schedule, r2Schedule, onR2Change, durations }) {
  const chartRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [hover, setHover] = useState(null);
  const CHART_WIDTH = 700, CHART_HEIGHT = 460;
  const PADDING = { top: 55, right: 30, bottom: 75, left: 70 };
  const PLOT_WIDTH = CHART_WIDTH - PADDING.left - PADDING.right;
  const PLOT_HEIGHT = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const MAX_DAY = 150;
  const dayToX = (day) => PADDING.left + (day / MAX_DAY) * PLOT_WIDTH;
  const xToDay = (x) => Math.round(((x - PADDING.left) / PLOT_WIDTH) * MAX_DAY);
  const distToY = (dist) => PADDING.top + PLOT_HEIGHT - (dist / PROJECT_LENGTH) * PLOT_HEIGHT;
  const getLinePoints = (start, end) => { if (!start || !end || start <= 0) return ''; return `${dayToX(start)},${distToY(0)} ${dayToX(end)},${distToY(PROJECT_LENGTH)}`; };
  const getDistAtDay = (start, end, day, rate) => { if (!start || !end || start <= 0) return 0; if (day < start) return 0; if (day > end) return PROJECT_LENGTH; return Math.min(Math.round(rate * (day - start + 1)), PROJECT_LENGTH); };

  const handleDragStart = (activity, clientX) => { const rect = chartRef.current.getBoundingClientRect(); setDragOffset(clientX - rect.left - dayToX(r2Schedule[activity + 'S'])); setDragging(activity); };
  const handleMouseDown = (activity, e) => { e.preventDefault(); e.stopPropagation(); handleDragStart(activity, e.clientX); };
  const handleTouchStart = (activity, e) => { e.preventDefault(); e.stopPropagation(); handleDragStart(activity, e.touches[0].clientX); };
  const handleDragMove = useCallback((clientX) => { if (!dragging || !chartRef.current) return; const rect = chartRef.current.getBoundingClientRect(); const newStart = Math.max(MOB_DAYS + 1, Math.min(xToDay(clientX - rect.left - dragOffset), MAX_DAY - 20)); onR2Change({ ...r2Schedule, [dragging + 'S']: newStart }); }, [dragging, dragOffset, r2Schedule, onR2Change]);
  const handleMouseMove = useCallback((e) => handleDragMove(e.clientX), [handleDragMove]);
  const handleTouchMove = useCallback((e) => { e.preventDefault(); handleDragMove(e.touches[0].clientX); }, [handleDragMove]);
  const handleDragEnd = useCallback(() => setDragging(null), []);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: false }); window.addEventListener('touchend', handleDragEnd);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleDragEnd); window.removeEventListener('touchmove', handleTouchMove); window.removeEventListener('touchend', handleDragEnd); };
  }, [dragging, handleMouseMove, handleTouchMove, handleDragEnd]);

  const handleChartHover = (e) => { if (dragging || !chartRef.current) return; const rect = chartRef.current.getBoundingClientRect(); const x = e.clientX - rect.left; const day = xToDay(x); if (day >= 0 && day <= MAX_DAY && x >= PADDING.left && x <= CHART_WIDTH - PADDING.right) setHover({ day, x, y: e.clientY - rect.top }); else setHover(null); };

  const r1Lines = { exc: { start: r1Schedule.excS, end: r1Schedule.excE }, pipe: { start: r1Schedule.pipeS, end: r1Schedule.pipeE }, back: { start: r1Schedule.backS, end: r1Schedule.backE } };
  const r2Lines = { exc: { start: r2Schedule.excS, end: r2Schedule.excS + durations.exc - 1 }, pipe: { start: r2Schedule.pipeS, end: r2Schedule.pipeS + durations.pipe - 1 }, back: { start: r2Schedule.backS, end: r2Schedule.backS + durations.back - 1 } };
  const colors = { exc: { stroke: '#2563eb', name: 'Excavation & Bedding', rate: CREWS.exc.rate }, pipe: { stroke: '#16a34a', name: 'Pipe Laying & Alignment', rate: CREWS.pipe.rate }, back: { stroke: '#ea580c', name: 'Backfill & Compaction', rate: CREWS.back.rate } };
  const r2Sched = { excS: r2Lines.exc.start, excE: r2Lines.exc.end, pipeS: r2Lines.pipe.start, pipeE: r2Lines.pipe.end, backS: r2Lines.back.start, backE: r2Lines.back.end };
  const r2Conflicts = findConflicts(r2Sched, durations);
  const buffer1 = r2Schedule.pipeS - r2Schedule.excS, buffer1Ok = buffer1 === DEFAULT_BUFFER;
  const buffer2 = r2Lines.back.end - r2Lines.pipe.end, buffer2Ok = buffer2 === DEFAULT_BUFFER;
  const xTicks = [0, 20, 40, 60, 80, 100, 120, 140], yTicks = [0, 4000, 8000, 12000, 16000];

  const BufferArrow = ({ x1, x2, y, label, isOk, position = 'above' }) => {
    const color = isOk ? '#16a34a' : '#ef4444'; const midX = (x1 + x2) / 2; const ah = 5;
    if (Math.abs(x2 - x1) < 3) return null;
    const labelY = position === 'above' ? y - 6 : y + 18; const rectY = position === 'above' ? y - 20 : y + 5;
    return (<g><line x1={x1} y1={y} x2={x2} y2={y} stroke={color} strokeWidth="1.5" /><polygon points={`${x1},${y} ${x1 + ah},${y - ah + 1} ${x1 + ah},${y + ah - 1}`} fill={color} /><polygon points={`${x2},${y} ${x2 - ah},${y - ah + 1} ${x2 - ah},${y + ah - 1}`} fill={color} /><rect x={midX - 16} y={rectY} width="32" height="16" rx="3" fill={isOk ? '#dcfce7' : '#fee2e2'} stroke={color} strokeWidth="0.75" /><text x={midX} y={labelY} textAnchor="middle" fontSize="11" fill={color} fontWeight="bold">{label}</text></g>);
  };

  return (
    <div>
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1 min-w-0 overflow-x-auto pb-2">
          <svg ref={chartRef} width={CHART_WIDTH} height={CHART_HEIGHT} className="bg-white border rounded" style={{ minWidth: CHART_WIDTH, touchAction: 'pan-x' }} onMouseMove={handleChartHover} onMouseLeave={() => !dragging && setHover(null)}>
            {xTicks.map(day => (<line key={`gx-${day}`} x1={dayToX(day)} y1={PADDING.top} x2={dayToX(day)} y2={CHART_HEIGHT - PADDING.bottom} stroke="#f3f4f6" strokeWidth="1" />))}
            {yTicks.map(dist => (<line key={`gy-${dist}`} x1={PADDING.left} y1={distToY(dist)} x2={CHART_WIDTH - PADDING.right} y2={distToY(dist)} stroke="#f3f4f6" strokeWidth="1" />))}
            <line x1={PADDING.left} y1={CHART_HEIGHT - PADDING.bottom} x2={CHART_WIDTH - PADDING.right} y2={CHART_HEIGHT - PADDING.bottom} stroke="#374151" strokeWidth="2" />
            <line x1={PADDING.left} y1={PADDING.top} x2={PADDING.left} y2={CHART_HEIGHT - PADDING.bottom} stroke="#374151" strokeWidth="2" />
            {xTicks.map(day => (<text key={`tx-${day}`} x={dayToX(day)} y={CHART_HEIGHT - PADDING.bottom + 18} textAnchor="middle" fontSize="11" fill="#6b7280">{day}</text>))}
            <text x={CHART_WIDTH / 2} y={CHART_HEIGHT - 8} textAnchor="middle" fontSize="12" fill="#374151">Time (days)</text>
            {yTicks.map(dist => (<text key={`ty-${dist}`} x={PADDING.left - 10} y={distToY(dist) + 4} textAnchor="end" fontSize="11" fill="#6b7280">{(dist / 1000)}k</text>))}
            <text x={15} y={CHART_HEIGHT / 2} textAnchor="middle" transform={`rotate(-90, 15, ${CHART_HEIGHT / 2})`} fontSize="12" fill="#374151">Distance (ft)</text>
            {['exc', 'pipe', 'back'].map(id => (<polyline key={`r1-${id}`} points={getLinePoints(r1Lines[id].start, r1Lines[id].end)} fill="none" stroke={colors[id].stroke} strokeWidth="2" strokeDasharray="6,4" opacity="0.4" />))}
            {['exc', 'pipe', 'back'].map(id => (<g key={`r2-${id}`}><polyline points={getLinePoints(r2Lines[id].start, r2Lines[id].end)} fill="none" stroke="transparent" strokeWidth="30" style={{ cursor: 'grab', touchAction: 'none' }} onMouseDown={(e) => handleMouseDown(id, e)} onTouchStart={(e) => handleTouchStart(id, e)} /><polyline points={getLinePoints(r2Lines[id].start, r2Lines[id].end)} fill="none" stroke={colors[id].stroke} strokeWidth="3" className={dragging === id ? 'opacity-60' : ''} style={{ cursor: 'grab', touchAction: 'none', pointerEvents: 'none' }} /><circle cx={dayToX(r2Lines[id].start)} cy={distToY(0)} r="14" fill={colors[id].stroke} stroke="white" strokeWidth="3" className={dragging === id ? 'opacity-60' : ''} style={{ cursor: 'grab', touchAction: 'none' }} onMouseDown={(e) => handleMouseDown(id, e)} onTouchStart={(e) => handleTouchStart(id, e)} /></g>))}
            {r2Lines.exc.start > 0 && r2Lines.pipe.start > 0 && <BufferArrow x1={dayToX(r2Lines.exc.start)} x2={dayToX(r2Lines.pipe.start)} y={CHART_HEIGHT - PADDING.bottom + 38} label={`${buffer1}d`} isOk={buffer1Ok} position="below" />}
            {r2Lines.pipe.end > 0 && r2Lines.back.end > 0 && <BufferArrow x1={dayToX(r2Lines.pipe.end)} x2={dayToX(r2Lines.back.end)} y={PADDING.top - 20} label={`${buffer2}d`} isOk={buffer2Ok} position="above" />}
            {r2Conflicts.map((c, i) => { const cx = dayToX(c.day), cy = distToY(c.dist); return (<g key={`r2c-${i}`}><circle cx={cx} cy={cy} r="12" fill="#ef4444" opacity="0.15" /><circle cx={cx} cy={cy} r="7" fill="#ef4444" /><text x={cx} y={cy + 3.5} textAnchor="middle" fontSize="9" fill="white" fontWeight="bold">✕</text></g>); })}
            {hover && !dragging && <line x1={dayToX(hover.day)} y1={PADDING.top} x2={dayToX(hover.day)} y2={CHART_HEIGHT - PADDING.bottom} stroke="#9ca3af" strokeWidth="1" strokeDasharray="3,3" />}
            {dragging && <text x={CHART_WIDTH / 2} y={PADDING.top - 8} textAnchor="middle" fontSize="12" fill="#d97706" fontWeight="bold">Dragging {colors[dragging].name}...</text>}
          </svg>
          {hover && !dragging && (<div className="absolute bg-white border border-gray-300 rounded shadow-lg p-2 text-xs pointer-events-none z-10" style={{ left: Math.min(hover.x + 12, CHART_WIDTH - 180), top: Math.max(hover.y - 90, 5) }}><div className="font-bold mb-1 border-b pb-1">Day {hover.day}</div>{['exc', 'pipe', 'back'].map(id => (<div key={id} className="flex justify-between gap-4" style={{ color: colors[id].stroke }}><span>{colors[id].name.split(' & ')[0]}:</span><span className="font-mono">{getDistAtDay(r2Lines[id].start, r2Lines[id].end, hover.day, colors[id].rate).toLocaleString()} ft</span></div>))}</div>)}
          <div className="text-center text-xs text-gray-400 mt-1 lg:hidden">← Swipe to scroll chart →</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-xs flex-shrink-0 self-start hidden lg:block" style={{ minWidth: '140px' }}>
          <div className="font-bold text-gray-500 mb-1.5 border-b pb-1">R1 (original)</div>
          {['exc', 'pipe', 'back'].map(id => (<div key={`r1-leg-${id}`} className="flex items-center gap-2 mb-1"><svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke={colors[id].stroke} strokeWidth="2" strokeDasharray="4,3" opacity="0.5" /></svg><span style={{ color: colors[id].stroke }}>{colors[id].name.split(' & ')[0]}</span></div>))}
          <div className="font-bold text-gray-500 mt-3 mb-1.5 border-b pb-1">R2 (drag to revise)</div>
          {['exc', 'pipe', 'back'].map(id => (<div key={`r2-leg-${id}`} className="flex items-center gap-2 mb-1"><svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke={colors[id].stroke} strokeWidth="3" /></svg><span style={{ color: colors[id].stroke }}>{colors[id].name.split(' & ')[0]}</span></div>))}
        </div>
      </div>
      <p className="text-sm text-gray-500 mt-2 text-center"><span className="hidden md:inline">🖱️ Drag the solid lines or circles to adjust start days</span><span className="md:hidden">👆 Touch and drag the circles to adjust start days</span></p>
      <div className="lg:hidden mt-2 flex flex-wrap gap-x-3 gap-y-1 justify-center text-xs">
        <span className="text-gray-500 font-bold">R1 ---</span>{['exc', 'pipe', 'back'].map(id => (<span key={`sm-r1-${id}`} style={{ color: colors[id].stroke }}>{colors[id].name.split(' & ')[0]}</span>))}
        <span className="text-gray-500 font-bold ml-2">R2 ─</span>{['exc', 'pipe', 'back'].map(id => (<span key={`sm-r2-${id}`} style={{ color: colors[id].stroke }}>{colors[id].name.split(' & ')[0]}</span>))}
      </div>
    </div>
  );
}
// -------------------- END R2 COMPONENTS --------------------

// ==================== PRE-SURVEY COMPONENT ====================
function PreSurvey({ onComplete }) {
  const [step, setStep] = useState(1);
  const [demographics, setDemographics] = useState({ favoriteColor: '', lastFourDigits: '', fieldOfStudy: '', priorCourses: '', lobFamiliarity: '' });
  const [knowledge, setKnowledge] = useState({});
  const [selfConfidence, setSelfConfidence] = useState({});

  const isDemoComplete = demographics.favoriteColor && demographics.lastFourDigits && demographics.fieldOfStudy && demographics.priorCourses && demographics.lobFamiliarity;
  const isKnowledgeComplete = KNOWLEDGE_QUESTIONS.every(q => knowledge[q.id]);
  const isSCComplete = SELF_CONFIDENCE_QUESTIONS.every(q => selfConfidence[q.id]);

  const handleSubmit = () => {
    const knowledgeScore = calculateKnowledgeScore(knowledge);
    const scScore = calculateMeanScore(selfConfidence, SELF_CONFIDENCE_QUESTIONS);
    const anonymousId = `${demographics.favoriteColor}_${demographics.lastFourDigits}`;
    onComplete({ demographics, anonymousId, knowledge, knowledgeScore, selfConfidence, scScore });
  };

  const getOptionClass = (selected, current) => `block w-full p-3 rounded-lg border-2 cursor-pointer text-left transition-all ${selected === current ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`;
  const getRatingClass = (selected, current) => `flex-1 flex flex-col items-center cursor-pointer p-3 rounded-lg border-2 transition-all ${selected === current ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 p-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center text-white mb-6"><h1 className="text-3xl font-bold">Pre-Game Survey</h1><p className="text-blue-200 mt-1">Please complete all sections before starting the game</p></div>
        <div className="bg-white rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between text-sm">
            {[{ num: 1, title: 'About You' }, { num: 2, title: 'Knowledge' }, { num: 3, title: 'Confidence' }].map((s, i) => (
              <React.Fragment key={s.num}>
                <div className={`flex items-center gap-2 ${step >= s.num ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm ${step >= s.num ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>{step > s.num ? '✓' : s.num}</span>
                  <span className="hidden sm:inline">{s.title}</span>
                </div>
                {i < 2 && <div className="flex-1 h-1 mx-2 bg-gray-200 rounded"><div className={`h-full bg-blue-600 rounded transition-all ${step > s.num ? 'w-full' : 'w-0'}`} /></div>}
              </React.Fragment>
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="bg-white rounded-xl p-6 space-y-5">
            <h2 className="text-xl font-bold text-gray-800 border-b pb-2">About You</h2>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">What's your favorite color? *</label><input type="text" value={demographics.favoriteColor} onChange={e => setDemographics({ ...demographics, favoriteColor: e.target.value })} className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" placeholder="e.g., Blue" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">What are the last four digits of your cell phone? *</label><input type="text" value={demographics.lastFourDigits} onChange={e => setDemographics({ ...demographics, lastFourDigits: e.target.value.replace(/\D/g, '').slice(0, 4) })} className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" placeholder="e.g., 1234" maxLength={4} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-2">Field of Study *</label><div className="space-y-2">{['Construction Science', 'Construction Engineering', 'Civil Engineering', 'Architecture', 'Architectural Engineering', 'Other'].map(opt => (<label key={opt} className={getOptionClass(demographics.fieldOfStudy, opt)}><input type="radio" name="fieldOfStudy" value={opt} checked={demographics.fieldOfStudy === opt} onChange={e => setDemographics({ ...demographics, fieldOfStudy: e.target.value })} className="mr-3" />{opt}</label>))}</div></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-2">Have you taken any construction scheduling courses before? *</label><div className="flex gap-4">{['Yes', 'No'].map(opt => (<label key={opt} className={`flex-1 p-4 rounded-lg border-2 cursor-pointer text-center transition-all ${demographics.priorCourses === opt ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}><input type="radio" name="priorCourses" value={opt} checked={demographics.priorCourses === opt} onChange={e => setDemographics({ ...demographics, priorCourses: e.target.value })} className="mr-2" />{opt}</label>))}</div></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-2">How familiar are you with Line of Balance (LOB) scheduling? *</label><div className="space-y-2">{[{ value: 'no_experience', label: 'No Experience' }, { value: 'learned_in_class', label: 'Learned in Class' }, { value: 'used_in_practice', label: 'Used in Practice' }].map(opt => (<label key={opt.value} className={getOptionClass(demographics.lobFamiliarity, opt.value)}><input type="radio" name="lobFamiliarity" value={opt.value} checked={demographics.lobFamiliarity === opt.value} onChange={e => setDemographics({ ...demographics, lobFamiliarity: e.target.value })} className="mr-3" />{opt.label}</label>))}</div></div>
            <button onClick={() => setStep(2)} disabled={!isDemoComplete} className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${isDemoComplete ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>Continue to Knowledge Assessment →</button>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white rounded-xl p-6 space-y-5">
            <h2 className="text-xl font-bold text-gray-800 border-b pb-2">Knowledge Assessment</h2>
            <p className="text-sm text-gray-600">Answer the following questions to the best of your knowledge.</p>
            {KNOWLEDGE_QUESTIONS.map((q, index) => (
              <div key={q.id} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-bold text-gray-800 mb-3"><span className="text-blue-600">{index + 1}.</span> {q.question}</h3>
                <div className="space-y-2">{q.options.map(opt => (<label key={opt.value} className={getOptionClass(knowledge[q.id], opt.value)}><input type="radio" name={q.id} value={opt.value} checked={knowledge[q.id] === opt.value} onChange={e => setKnowledge({ ...knowledge, [q.id]: e.target.value })} className="mr-3" /><span className="font-medium">{opt.value.toUpperCase()})</span> {opt.label}</label>))}</div>
              </div>
            ))}
            <div className="flex gap-3 pt-2"><button onClick={() => setStep(1)} className="flex-1 py-3 rounded-lg font-bold border-2 border-gray-300 hover:bg-gray-50">← Back</button><button onClick={() => setStep(3)} disabled={!isKnowledgeComplete} className={`flex-1 py-3 rounded-lg font-bold transition-all ${isKnowledgeComplete ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>Continue →</button></div>
          </div>
        )}

        {step === 3 && (
          <div className="bg-white rounded-xl p-6 space-y-5">
            <h2 className="text-xl font-bold text-gray-800 border-b pb-2">Self-Confidence Level</h2>
            <p className="text-sm text-gray-600">Rate your confidence in performing the following tasks (1 = Not confident at all, 5 = Very confident)</p>
            {SELF_CONFIDENCE_QUESTIONS.map((q, index) => (
              <div key={q.id} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-800 mb-3"><span className="text-blue-600">{index + 1}.</span> {q.question}</h3>
                <div className="flex justify-between gap-2">{[1, 2, 3, 4, 5].map(num => (<label key={num} className={getRatingClass(selfConfidence[q.id], num)}><input type="radio" className="sr-only" checked={selfConfidence[q.id] === num} onChange={() => setSelfConfidence({ ...selfConfidence, [q.id]: num })} /><span className={`text-2xl font-bold ${selfConfidence[q.id] === num ? 'text-blue-600' : 'text-gray-400'}`}>{num}</span><span className="text-xs text-gray-500 mt-1">{num === 1 ? 'Low' : num === 5 ? 'High' : ''}</span></label>))}</div>
              </div>
            ))}
            <div className="flex gap-3 pt-2"><button onClick={() => setStep(2)} className="flex-1 py-3 rounded-lg font-bold border-2 border-gray-300 hover:bg-gray-50">← Back</button><button onClick={handleSubmit} disabled={!isSCComplete} className={`flex-1 py-3 rounded-lg font-bold transition-all ${isSCComplete ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>Start Game →</button></div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== POST-SURVEY COMPONENT ====================
function PostSurvey({ onComplete, playerName, preKnowledgeScore, preSCScore }) {
  const [step, setStep] = useState(1);
  const [knowledge, setKnowledge] = useState({});
  const [selfConfidence, setSelfConfidence] = useState({});
  const [experience, setExperience] = useState({});
  const [commentPlus, setCommentPlus] = useState('');
  const [commentDelta, setCommentDelta] = useState('');

  const isKnowledgeComplete = KNOWLEDGE_QUESTIONS.every(q => knowledge[q.id]);
  const isSCComplete = SELF_CONFIDENCE_QUESTIONS.every(q => selfConfidence[q.id]);
  const isEXComplete = EXPERIENCE_QUESTIONS.every(q => experience[q.id]);

  const handleSubmit = () => {
    const knowledgeScore = calculateKnowledgeScore(knowledge);
    const scScore = calculateMeanScore(selfConfidence, SELF_CONFIDENCE_QUESTIONS);
    const exScore = calculateMeanScore(experience, EXPERIENCE_QUESTIONS);
    onComplete({ knowledge, knowledgeScore, knowledgeGain: knowledgeScore - preKnowledgeScore, selfConfidence, scScore, scGain: (parseFloat(scScore) - parseFloat(preSCScore)).toFixed(2), experience, exScore, commentPlus, commentDelta });
  };

  const getOptionClass = (selected, current) => `block w-full p-3 rounded-lg border-2 cursor-pointer text-left transition-all ${selected === current ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'}`;
  const getRatingClass = (selected, current) => `flex-1 flex flex-col items-center cursor-pointer p-3 rounded-lg border-2 transition-all ${selected === current ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-600 p-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center text-white mb-6"><h1 className="text-3xl font-bold">Post-Game Survey</h1><p className="text-green-200 mt-1">Almost done, {playerName}!</p></div>
        <div className="bg-white rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between text-sm">
            {[{ num: 1, title: 'Knowledge' }, { num: 2, title: 'Confidence' }, { num: 3, title: 'Experience' }].map((s, i) => (
              <React.Fragment key={s.num}>
                <div className={`flex items-center gap-2 ${step >= s.num ? 'text-green-600 font-bold' : 'text-gray-400'}`}>
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm ${step >= s.num ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>{step > s.num ? '✓' : s.num}</span>
                  <span className="hidden sm:inline">{s.title}</span>
                </div>
                {i < 2 && <div className="flex-1 h-1 mx-2 bg-gray-200 rounded"><div className={`h-full bg-green-600 rounded transition-all ${step > s.num ? 'w-full' : 'w-0'}`} /></div>}
              </React.Fragment>
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="bg-white rounded-xl p-6 space-y-5">
            <h2 className="text-xl font-bold text-gray-800 border-b pb-2">Knowledge Assessment (Post-Game)</h2>
            <p className="text-sm text-gray-600">Let's see how much you learned! Answer the same questions again.</p>
            {KNOWLEDGE_QUESTIONS.map((q, index) => (
              <div key={q.id} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-bold text-gray-800 mb-3"><span className="text-green-600">{index + 1}.</span> {q.question}</h3>
                <div className="space-y-2">{q.options.map(opt => (<label key={opt.value} className={getOptionClass(knowledge[q.id], opt.value)}><input type="radio" name={`post-${q.id}`} value={opt.value} checked={knowledge[q.id] === opt.value} onChange={e => setKnowledge({ ...knowledge, [q.id]: e.target.value })} className="mr-3" /><span className="font-medium">{opt.value.toUpperCase()})</span> {opt.label}</label>))}</div>
              </div>
            ))}
            <button onClick={() => setStep(2)} disabled={!isKnowledgeComplete} className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${isKnowledgeComplete ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>Continue →</button>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white rounded-xl p-6 space-y-5">
            <h2 className="text-xl font-bold text-gray-800 border-b pb-2">Confidence Level (Post-Game)</h2>
            <p className="text-sm text-gray-600">Rate your confidence now after playing the game (1 = Not confident, 5 = Very confident)</p>
            {SELF_CONFIDENCE_QUESTIONS.map((q, index) => (
              <div key={q.id} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-800 mb-3"><span className="text-green-600">{index + 1}.</span> {q.question}</h3>
                <div className="flex justify-between gap-2">{[1, 2, 3, 4, 5].map(num => (<label key={num} className={getRatingClass(selfConfidence[q.id], num)}><input type="radio" className="sr-only" checked={selfConfidence[q.id] === num} onChange={() => setSelfConfidence({ ...selfConfidence, [q.id]: num })} /><span className={`text-2xl font-bold ${selfConfidence[q.id] === num ? 'text-green-600' : 'text-gray-400'}`}>{num}</span></label>))}</div>
              </div>
            ))}
            <div className="flex gap-3 pt-2"><button onClick={() => setStep(1)} className="flex-1 py-3 rounded-lg font-bold border-2 border-gray-300 hover:bg-gray-50">← Back</button><button onClick={() => setStep(3)} disabled={!isSCComplete} className={`flex-1 py-3 rounded-lg font-bold transition-all ${isSCComplete ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>Continue →</button></div>
          </div>
        )}

        {step === 3 && (
          <div className="bg-white rounded-xl p-6 space-y-5">
            <h2 className="text-xl font-bold text-gray-800 border-b pb-2">Game Experience</h2>
            <p className="text-sm text-gray-600">Please rate your experience with the game (1 = Strongly Disagree, 5 = Strongly Agree)</p>
            {EXPERIENCE_QUESTIONS.map((q, index) => (
              <div key={q.id} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-800 mb-3"><span className="text-green-600">{index + 1}.</span> {q.question}</h3>
                <div className="flex justify-between gap-2">{[1, 2, 3, 4, 5].map(num => (<label key={num} className={getRatingClass(experience[q.id], num)}><input type="radio" className="sr-only" checked={experience[q.id] === num} onChange={() => setExperience({ ...experience, [q.id]: num })} /><span className={`text-2xl font-bold ${experience[q.id] === num ? 'text-green-600' : 'text-gray-400'}`}>{num}</span></label>))}</div>
              </div>
            ))}
            <div><label className="block text-sm font-medium text-gray-700 mb-2">Plus: What aspect do you like most about the game? (Optional)</label><textarea value={commentPlus} onChange={e => setCommentPlus(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none" rows={3} placeholder="What did you like most?" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-2">Delta: What aspect do you think could be improved? (Optional)</label><textarea value={commentDelta} onChange={e => setCommentDelta(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none" rows={3} placeholder="What could be improved?" /></div>
            <div className="flex gap-3 pt-2"><button onClick={() => setStep(2)} className="flex-1 py-3 rounded-lg font-bold border-2 border-gray-300 hover:bg-gray-50">← Back</button><button onClick={handleSubmit} disabled={!isEXComplete} className={`flex-1 py-3 rounded-lg font-bold transition-all ${isEXComplete ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>Complete Survey →</button></div>
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
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-6"><div className="text-green-700 font-bold">✓ Your responses have been recorded</div></div>
      </div>
    </div>
  );
}

// ==================== MAIN GAME COMPONENT ====================
// R2 input cell (defined outside LOBGame to prevent focus loss on re-render)
function R2InputCell({ value, onChange, correct, submitted }) {
  let bg = "bg-yellow-50 border-yellow-400";
  if (submitted) bg = parseInt(value) === correct ? "bg-green-100 border-green-500" : "bg-red-100 border-red-500";
  return <input type="number" value={value} onChange={onChange} className={`w-16 px-1 py-1 border-2 rounded text-center text-sm ${bg}`} />;
}

export default function LOBGame() {
  const [round, setRound] = useState(0);
  const [highestRound, setHighestRound] = useState(0); // tracks furthest round reached
  const [backCount, setBackCount] = useState({ r2to1: 0, r3to2: 0, r4to3: 0, r5to4: 0, summaryTo5: 0 });
  const [preSurveyData, setPreSurveyData] = useState(null);
  const [postSurveyData, setPostSurveyData] = useState(null);

  const [r1Schedule, setR1Schedule] = useState(null);
  const [r2Schedule, setR2Schedule] = useState(null);
  const [r2Validated, setR2Validated] = useState(false);
  const [r2FlashCards, setR2FlashCards] = useState({ whyProblem: false, whyMatter: false, whatIsLOB: false, howToFix: false, distanceCalc: false, assumptions: false, howToRevise: false });

  useEffect(() => {
    if (round === 3 && !r2Schedule && r1Schedule) {
      setR2Schedule({ excS: r1Schedule.excS, pipeS: r1Schedule.pipeS, backS: r1Schedule.backS });
    }
  }, [round, r2Schedule, r1Schedule]);

  const [r3Buffer, setR3Buffer] = useState(5);
  const [r4Eq, setR4Eq] = useState({ exc: 1, pipe: 0, back: 1 });
  const [r5Config, setR5Config] = useState({
    exc: { small: 0, standard: 1, large: 0 },
    pipe: { standard: 1, heavy: 0 },
    back: { small: 0, standard: 1, large: 0 },
  });
  const [r5Buffer, setR5Buffer] = useState(5);
  const [results, setResults] = useState({});
  const [r5FirstAttempt, setR5FirstAttempt] = useState(null); // stores first R5 result for improvement analysis

  // ==================== DATA LOGGING SYSTEM ====================
  const [gameLog, setGameLog] = useState({
    sessionId: `session_${Date.now()}`,
    startTime: null, endTime: null, studentName: '',
    rounds: {
      1: { startTime: null, endTime: null, timeSpent: 0, attempts: {}, values: {}, completed: false },
      2: { startTime: null, endTime: null, timeSpent: 0, attempts: {}, values: {}, completed: false },
      3: { startTime: null, endTime: null, timeSpent: 0, attempts: {}, values: {}, completed: false },
      4: { startTime: null, endTime: null, timeSpent: 0, attempts: {}, values: {}, completed: false },
      5: { startTime: null, endTime: null, timeSpent: 0, attempts: {}, values: {}, completed: false },
    },
    events: [],
  });

  const logEvent = useCallback((eventType, eventData) => {
    const timestamp = new Date().toISOString();
    setGameLog(prev => ({ ...prev, events: [...prev.events, { timestamp, eventType, ...eventData }] }));
  }, []);

  useEffect(() => {
    const gameRound = round - 1; // round 2=R1, 3=R2, etc.
    if (gameRound >= 1 && gameRound <= 5) {
      const now = new Date().toISOString();
      setGameLog(prev => ({ ...prev, rounds: { ...prev.rounds, [gameRound]: { ...prev.rounds[gameRound], startTime: now } } }));
      logEvent('ROUND_START', { round: gameRound });
    }
  }, [round, logEvent]);

  const logValueChange = useCallback((roundNum, valueKey, value) => {
    setGameLog(prev => ({ ...prev, rounds: { ...prev.rounds, [roundNum]: { ...prev.rounds[roundNum], values: { ...prev.rounds[roundNum].values, [valueKey]: value } } } }));
    logEvent('VALUE_CHANGE', { round: roundNum, key: valueKey, value });
  }, [logEvent]);

  const completeRound = useCallback((roundNum, finalValues = {}) => {
    const now = new Date().toISOString();
    setGameLog(prev => {
      const roundData = prev.rounds[roundNum];
      const startTime = roundData?.startTime ? new Date(roundData.startTime) : new Date();
      const timeSpent = Math.round((new Date(now) - startTime) / 1000);
      return { ...prev, rounds: { ...prev.rounds, [roundNum]: { ...roundData, endTime: now, timeSpent, completed: true, values: { ...roundData.values, ...finalValues } } } };
    });
    logEvent('ROUND_COMPLETE', { round: roundNum, finalValues });
  }, [logEvent]);

  const generateExportData = useCallback(() => {
    const now = new Date().toISOString();
    return { ...gameLog, endTime: now, exportedAt: now, summary: { totalTimeMinutes: Object.values(gameLog.rounds).reduce((sum, r) => sum + (r.timeSpent || 0), 0) / 60, roundsCompleted: Object.values(gameLog.rounds).filter(r => r.completed).length, finalResult: results[5] || null } };
  }, [gameLog, results]);

  const downloadGameData = useCallback(() => {
    const data = generateExportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `LOB_Game_${gameLog.studentName || 'student'}_${gameLog.sessionId}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }, [generateExportData, gameLog.studentName, gameLog.sessionId]);

  const downloadGameDataCSV = useCallback(() => {
    const data = generateExportData();
    const rows = [['Field', 'Value'], ['Session ID', data.sessionId], ['Student Name', data.studentName], ['Start Time', data.startTime], ['End Time', data.endTime], ['Total Time (minutes)', data.summary.totalTimeMinutes.toFixed(2)], ['Rounds Completed', data.summary.roundsCompleted], [''], ['Round', 'Start Time', 'End Time', 'Time Spent (sec)', 'Completed', 'Attempts', 'Values']];
    for (let r = 1; r <= 5; r++) { const rd = data.rounds[r]; rows.push([`Round ${r}`, rd.startTime || '', rd.endTime || '', rd.timeSpent || 0, rd.completed ? 'Yes' : 'No', JSON.stringify(rd.attempts), JSON.stringify(rd.values)]); }
    if (data.summary.finalResult) { rows.push([''], ['Final Results'], ['Duration (days)', data.summary.finalResult.end], ['Cost ($)', data.summary.finalResult.cost], ['Buffer (days)', data.summary.finalResult.buffer], ['Passed', data.summary.finalResult.pass ? 'Yes' : 'No']); }
    const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `LOB_Game_${gameLog.studentName || 'student'}_${gameLog.sessionId}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }, [generateExportData, gameLog.studentName, gameLog.sessionId]);
  // ==================== END DATA LOGGING SYSTEM ====================

  const dur = useMemo(() => ({ exc: Math.ceil(PROJECT_LENGTH / CREWS.exc.rate), pipe: Math.ceil(PROJECT_LENGTH / CREWS.pipe.rate), back: Math.ceil(PROJECT_LENGTH / CREWS.back.rate) }), []);

  const r1Student = useMemo(() => {
    if (!r1Schedule) return { excS: 0, excE: 0, pipeS: 0, pipeE: 0, backS: 0, backE: 0, end: 0 };
    return r1Schedule;
  }, [r1Schedule]);

  const r2Correct = useMemo(() => {
    const excS = MOB_DAYS + 1, excE = excS + dur.exc - 1;
    const pipeS = excS + DEFAULT_BUFFER, pipeE = pipeS + dur.pipe - 1;
    const backS = pipeE + DEFAULT_BUFFER - dur.back + 1, backE = backS + dur.back - 1;
    return { excS, excE, pipeS, pipeE, backS, backE, end: Math.max(excE, pipeE, backE) };
  }, [dur]);

  const r2Student = useMemo(() => {
    if (!r2Schedule) return r1Student;
    return { excS: r2Schedule.excS, excE: r2Schedule.excS + dur.exc - 1, pipeS: r2Schedule.pipeS, pipeE: r2Schedule.pipeS + dur.pipe - 1, backS: r2Schedule.backS, backE: r2Schedule.backS + dur.back - 1, end: Math.max(r2Schedule.excS + dur.exc - 1, r2Schedule.pipeS + dur.pipe - 1, r2Schedule.backS + dur.back - 1) };
  }, [r2Schedule, r1Student, dur]);

  const r2IsCorrect = r2Student.excS === r2Correct.excS && r2Student.pipeS === r2Correct.pipeS && r2Student.backS === r2Correct.backS;

  const r2Cost = useMemo(() => {
    const excC = dur.exc * CREWS.exc.cost, pipeC = dur.pipe * CREWS.pipe.cost, backC = dur.back * CREWS.back.cost;
    const direct = MOB_COST + excC + pipeC + backC;
    const indirect = Math.round(direct * INDIRECT_RATE), profit = Math.round((direct + indirect) * PROFIT_RATE);
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
    const pipeS = pipe.rate < exc.rate ? excS + DEFAULT_BUFFER : excE + DEFAULT_BUFFER - pipeDur + 1;
    const pipeE = pipeS + pipeDur - 1;
    const backS = back.rate < pipe.rate ? pipeS + DEFAULT_BUFFER : pipeE + DEFAULT_BUFFER - backDur + 1;
    const backE = backS + backDur - 1;
    return { excS, excE, excDur, excRate: exc.rate, excCost: exc.cost, excName: exc.name, pipeS, pipeE, pipeDur, pipeRate: pipe.rate, pipeCost: pipe.cost, pipeName: pipe.name, backS, backE, backDur, backRate: back.rate, backCost: back.cost, backName: back.name, end: Math.max(excE, pipeE, backE) };
  }, [r4Eq]);

  const r4Cost = useMemo(() => {
    const excC = r4.excDur * r4.excCost, pipeC = r4.pipeDur * r4.pipeCost, backC = r4.backDur * r4.backCost;
    const direct = MOB_COST + excC + pipeC + backC;
    const indirect = Math.round(direct * INDIRECT_RATE), profit = Math.round((direct + indirect) * PROFIT_RATE);
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
    const pipeS = r5Calc.pipe.rate < r5Calc.exc.rate ? excS + r5Buffer : excE + r5Buffer - pipeDur + 1;
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
    const rates = { exc: CREWS.exc.rate, pipe: CREWS.pipe.rate, back: CREWS.back.rate };
    for (let d = 0; d <= maxDay; d += 2) {
      const pt = { day: d };
      schedules.forEach((s, i) => {
        ['exc', 'pipe', 'back'].forEach(type => {
          const start = s[type + 'S'], end = s[type + 'E'];
          if (start > 0 && end > 0) {
            const rate = s[type + 'Rate'] || rates[type];
            pt[type + i] = d < start ? 0 : d > end ? PROJECT_LENGTH : Math.min(rate * (d - start + 1), PROJECT_LENGTH);
          }
        });
      });
      data.push(pt);
    }
    return data;
  };

  // nextRound now uses game rounds (round-1 maps to game round)
  const nextRound = () => {
    const gameRound = round - 1; // round 2=R1(gameRound1), round 3=R2(gameRound2), etc.
    const res = { round: gameRound };
    let roundValues = {};

    if (gameRound === 1) { Object.assign(res, { ...r1Student }); roundValues = { excStart: r1Student.excS, excEnd: r1Student.excE, pipeStart: r1Student.pipeS, pipeEnd: r1Student.pipeE, backStart: r1Student.backS, backEnd: r1Student.backE, projectEnd: r1Student.end }; }
    if (gameRound === 2) { Object.assign(res, { ...r2Student, cost: r2Cost.total }); roundValues = { excStart: r2Student.excS, pipeStart: r2Student.pipeS, backStart: r2Student.backS, projectEnd: r2Student.end, cost: r2Cost.total, buffer: DEFAULT_BUFFER }; }
    if (gameRound === 3) { Object.assign(res, { ...r3, buffer: r3Buffer }); roundValues = { buffer: r3Buffer, projectEnd: r3.end, cost: r2Cost.total }; }
    if (gameRound === 4) { Object.assign(res, { end: r4.end, cost: r4Cost.total }); roundValues = { excEquipment: r4.excName, pipeEquipment: r4.pipeName, backEquipment: r4.backName, projectEnd: r4.end, cost: r4Cost.total }; }
    if (gameRound === 5) { const passed = r5.end <= TARGET_DAYS && r5Cost.total <= TARGET_COST; Object.assign(res, { end: r5.end, cost: r5Cost.total, buffer: r5Buffer, pass: passed }); roundValues = { buffer: r5Buffer, excConfig: r5Config.exc, pipeConfig: r5Config.pipe, backConfig: r5Config.back, projectEnd: r5.end, cost: r5Cost.total, passed, metDurationTarget: r5.end <= TARGET_DAYS, metCostTarget: r5Cost.total <= TARGET_COST }; if (!r5FirstAttempt) setR5FirstAttempt({ end: r5.end, cost: r5Cost.total, buffer: r5Buffer, pass: passed }); }

    completeRound(gameRound, roundValues);
    setResults(p => ({ ...p, [gameRound]: res }));
    const nextR = round + 1;
    setRound(nextR);
    if (nextR > highestRound) setHighestRound(nextR);
  };

  // Go back one game round (only within game rounds 2-7)
  // round 2=R1, 3=R2, 4=R3, 5=R4, 6=R5, 7=GameSummary
  const goBack = () => {
    if (round < 3) return; // can't go back from R1 (round 2)
    const gameRound = round - 1;
    const backKey = gameRound === 1 ? null
      : gameRound === 2 ? 'r2to1'
      : gameRound === 3 ? 'r3to2'
      : gameRound === 4 ? 'r4to3'
      : gameRound === 5 ? 'r5to4'
      : null;
    // Special: round 7 (GameSummary) going back to R5 (round 6)
    const key = round === 7 ? 'summaryTo5' : backKey;
    if (key) {
      setBackCount(p => ({ ...p, [key]: p[key] + 1 }));
      logEvent('BACK_BUTTON', { from: round === 7 ? 'Summary' : `R${gameRound}`, to: round === 7 ? 'R5' : `R${gameRound - 1}`, count: backCount[key] + 1 });
    }
    setRound(round - 1);
  };

  // Check if back button should be shown
  const canGoBack = round >= 3 && round <= 7; // R2 through GameSummary

  const BudgetTable = ({ cost, durExc, durPipe, durBack, costExc, costPipe, costBack }) => (
    <div className="grid grid-cols-2 gap-4 text-sm">
      <table className="w-full border"><tbody>
        <tr><td className="px-2 py-1 border">Mobilization</td><td className="px-2 py-1 border text-right">${MOB_COST.toLocaleString()}</td></tr>
        <tr><td className="px-2 py-1 border">Excavation ({durExc}d × ${costExc})</td><td className="px-2 py-1 border text-right">${cost.excC.toLocaleString()}</td></tr>
        <tr><td className="px-2 py-1 border">Pipe Laying ({durPipe}d × ${costPipe})</td><td className="px-2 py-1 border text-right">${cost.pipeC.toLocaleString()}</td></tr>
        <tr><td className="px-2 py-1 border">Backfill ({durBack}d × ${costBack})</td><td className="px-2 py-1 border text-right">${cost.backC.toLocaleString()}</td></tr>
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

  const playerName = preSurveyData?.anonymousId || 'Student';

  // ==================== ROUND 0: INTRO ====================
  if (round === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="text-center text-white mb-6">
            <h1 className="text-4xl font-bold">🎮 LOB SIMULATION GAME</h1>
            <p className="text-blue-200">5-Round Educational Simulation</p>
          </div>

          <div className="bg-white rounded-xl p-5">
            <h2 className="text-xl font-bold text-blue-900 border-b pb-2 mb-4">📋 PROJECT OVERVIEW</h2>
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm leading-relaxed text-blue-900">
                This simulation places you in the role of a construction planner responsible for scheduling
                a major water pipeline project. Over five rounds, you will explore how crew productivity,
                spacing (buffers), and activity sequencing influence progress using the Line of Balance (LOB)
                method. Your goal is to build a feasible schedule, avoid crew conflicts, and optimize both
                duration and cost—just like a real project engineer.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div className="bg-blue-50 p-3 rounded"><div className="text-gray-500">Project</div><div className="font-bold">College Station Water Pipeline</div></div>
              <div className="bg-blue-50 p-3 rounded"><div className="text-gray-500">Pipeline Type</div><div className="font-bold">24" Prestressed Concrete Cylinder Pipe</div></div>
              <div className="bg-blue-50 p-3 rounded"><div className="text-gray-500">Total Length</div><div className="font-bold text-xl">{PROJECT_LENGTH.toLocaleString()} ft</div></div>
              <div className="bg-blue-50 p-3 rounded"><div className="text-gray-500">Mobilization</div><div className="font-bold">{MOB_DAYS} days — ${MOB_COST.toLocaleString()}</div></div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5">
            <h2 className="text-xl font-bold text-blue-900 border-b pb-2 mb-4">👷 CREW DEFINITIONS</h2>
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm leading-relaxed text-blue-900">This project uses three sequential pipeline crews—Excavation, Pipe Laying, and Backfill—each with its own productivity and equipment.</p>
            </div>
            <div className="space-y-3">
              <details className="group rounded-lg border border-blue-200 bg-blue-50 p-4">
                <summary className="flex cursor-pointer items-center justify-between list-none"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700">⛏️</div><div><div className="font-bold text-blue-900">Crew A — Excavation & Bedding</div><div className="text-xs text-blue-800/70">Uses Excavator</div></div></div><span className="text-blue-900/70 transition-transform group-open:rotate-180">▾</span></summary>
                <p className="mt-3 text-sm leading-relaxed text-blue-900">Crew A uses an <strong>Excavator</strong> to dig the trench and prepare the bedding. As the first crew in sequence, it sets the pace for all other crews.</p>
              </details>
              <details className="group rounded-lg border border-green-200 bg-green-50 p-4">
                <summary className="flex cursor-pointer items-center justify-between list-none"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-green-700">🔧</div><div><div className="font-bold text-green-900">Crew B — Pipe Laying & Alignment</div><div className="text-xs text-green-800/70">Uses Mobile Crane</div></div></div><span className="text-green-900/70 transition-transform group-open:rotate-180">▾</span></summary>
                <p className="mt-3 text-sm leading-relaxed text-green-900">Crew B uses a <strong>Mobile Crane</strong> to lift and align pipe sections in the trench prepared by Crew A.</p>
              </details>
              <details className="group rounded-lg border border-orange-200 bg-orange-50 p-4">
                <summary className="flex cursor-pointer items-center justify-between list-none"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-orange-700">🚜</div><div><div className="font-bold text-orange-900">Crew C — Backfill & Compaction</div><div className="text-xs text-orange-800/70">Uses Backfill Set</div></div></div><span className="text-orange-900/70 transition-transform group-open:rotate-180">▾</span></summary>
                <p className="mt-3 text-sm leading-relaxed text-orange-900">Crew C uses a <strong>Backfill Set</strong> (Excavator + Compactor) to place and compact soil over installed pipes.</p>
              </details>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm font-bold table-auto">
                <thead className="bg-blue-100"><tr><th className="px-3 py-3 text-left">Crew</th><th className="px-3 py-3 text-left">Activity</th><th className="px-3 py-3 text-left">Equipment</th><th className="px-3 py-3 text-right">Daily Cost ($/day)</th><th className="px-3 py-3 text-right">Production Rate (ft/day)</th></tr></thead>
                <tbody>
                  <tr className="bg-blue-50 border-b"><td className="px-3 py-3 text-blue-700">Crew A</td><td className="px-3 py-3">{CREWS.exc.name}</td><td className="px-3 py-3">{CREWS.exc.equipment}</td><td className="px-3 py-3 text-right">{CREWS.exc.cost}</td><td className="px-3 py-3 text-right">{CREWS.exc.rate}</td></tr>
                  <tr className="bg-green-50 border-b"><td className="px-3 py-3 text-green-700">Crew B</td><td className="px-3 py-3">{CREWS.pipe.name}</td><td className="px-3 py-3">{CREWS.pipe.equipment}</td><td className="px-3 py-3 text-right">{CREWS.pipe.cost}</td><td className="px-3 py-3 text-right">{CREWS.pipe.rate}</td></tr>
                  <tr className="bg-orange-50"><td className="px-3 py-3 text-orange-700">Crew C</td><td className="px-3 py-3">{CREWS.back.name}</td><td className="px-3 py-3">{CREWS.back.equipment}</td><td className="px-3 py-3 text-right">{CREWS.back.cost}</td><td className="px-3 py-3 text-right">{CREWS.back.rate}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5">
            <h2 className="text-xl font-bold text-blue-900 mb-4">🚀 Ready to Play?</h2>
            <button onClick={() => setRound(1)} className="w-full bg-blue-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-blue-700">Begin Survey →</button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== ROUND 1: PRE-SURVEY ====================
  if (round === 1) {
    return <PreSurvey onComplete={(data) => {
      setPreSurveyData(data);
      const startTime = new Date().toISOString();
      setGameLog(prev => ({ ...prev, startTime, studentName: data.anonymousId }));
      logEvent('GAME_START', { anonymousId: data.anonymousId });

      // Submit PreSurvey to Google Sheets
      submitToSheet('PreSurvey', {
        sessionId: gameLog.sessionId,
        anonymousId: data.anonymousId,
        favoriteColor: data.demographics.favoriteColor,
        lastFourDigits: data.demographics.lastFourDigits,
        fieldOfStudy: data.demographics.fieldOfStudy,
        priorCourses: data.demographics.priorCourses,
        lobFamiliarity: data.demographics.lobFamiliarity,
        K1: data.knowledge.K1, K2: data.knowledge.K2,
        K3: data.knowledge.K3, K4: data.knowledge.K4,
        K5: data.knowledge.K5, K6: data.knowledge.K6,
        K7: data.knowledge.K7, K8: data.knowledge.K8,
        knowledgeScore: data.knowledgeScore,
        SC1: data.selfConfidence.SC1, SC2: data.selfConfidence.SC2,
        SC3: data.selfConfidence.SC3, SC4: data.selfConfidence.SC4,
        scScore: data.scScore,
      });

      setRound(2);
    }} />;
  }

  // ==================== ROUND 8: POST-SURVEY ====================
  if (round === 8) {
    return <PostSurvey
      playerName={playerName}
      preKnowledgeScore={preSurveyData?.knowledgeScore || 0}
      preSCScore={preSurveyData?.scScore || '0.00'}
      onComplete={(data) => {
        setPostSurveyData(data);

        // Submit PostSurvey to Google Sheets
        submitToSheet('PostSurvey', {
          sessionId: gameLog.sessionId,
          anonymousId: preSurveyData?.anonymousId,
          K1: data.knowledge.K1, K2: data.knowledge.K2,
          K3: data.knowledge.K3, K4: data.knowledge.K4,
          K5: data.knowledge.K5, K6: data.knowledge.K6,
          K7: data.knowledge.K7, K8: data.knowledge.K8,
          knowledgeScore: data.knowledgeScore,
          knowledgeGain: data.knowledgeGain,
          SC1: data.selfConfidence.SC1, SC2: data.selfConfidence.SC2,
          SC3: data.selfConfidence.SC3, SC4: data.selfConfidence.SC4,
          scScore: data.scScore,
          scGain: data.scGain,
          EX1: data.experience.EX1, EX2: data.experience.EX2,
          EX3: data.experience.EX3, EX4: data.experience.EX4,
          EX5: data.experience.EX5, EX6: data.experience.EX6,
          exScore: data.exScore,
          commentPlus: data.commentPlus,
          commentDelta: data.commentDelta,
        });

        setRound(9);
      }}
    />;
  }

  // ==================== ROUND 9: THANK YOU ====================
  if (round === 9) {
    return <ThankYou />;
  }

  // ==================== ROUND 7: GAME SUMMARY ====================
  if (round === 7) {
    const pass = results[5]?.pass;
    const r2BaseCost = r2Cost.total;

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 p-4">
        <div className="max-w-4xl mx-auto bg-white rounded-xl p-6 space-y-6">
          <div className="text-center">
            <div className="text-6xl">{pass ? '🏆' : '📊'}</div>
            <h1 className="text-3xl font-bold text-blue-900">Game Complete!</h1>
            <p className="text-gray-600">Great job, {playerName}!</p>
          </div>

          <div className={`p-4 rounded-lg ${pass ? 'bg-green-100 border-2 border-green-500' : 'bg-yellow-100 border-2 border-yellow-500'}`}>
            <h3 className="font-bold text-lg">{pass ? '✅ Constraints Met!' : '⚠️ Constraints Not Met'}</h3>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div>Duration: <span className={`font-bold ${results[5]?.end <= TARGET_DAYS ? 'text-green-600' : 'text-red-600'}`}>{results[5]?.end} days</span> <span className="text-gray-400">(target: ≤{TARGET_DAYS})</span></div>
              <div>Cost: <span className={`font-bold ${results[5]?.cost <= TARGET_COST ? 'text-green-600' : 'text-red-600'}`}>${results[5]?.cost?.toLocaleString()}</span> <span className="text-gray-400">(target: ≤${TARGET_COST.toLocaleString()})</span></div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-bold text-lg mb-3">📊 Your Results by Round</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead><tr className="bg-blue-100"><th className="px-3 py-2 border text-left">Round</th><th className="px-3 py-2 border text-left">Description</th><th className="px-3 py-2 border text-center">Duration</th><th className="px-3 py-2 border text-center">Cost</th><th className="px-3 py-2 border text-center">Buffer</th></tr></thead>
                <tbody>
                  <tr className="bg-white"><td className="px-3 py-2 border font-bold text-blue-600">R1</td><td className="px-3 py-2 border">Bar Chart</td><td className="px-3 py-2 border text-center">{results[1]?.end || '-'} days</td><td className="px-3 py-2 border text-center">${r2BaseCost.toLocaleString()}</td><td className="px-3 py-2 border text-center text-gray-400">-</td></tr>
                  <tr className="bg-gray-50"><td className="px-3 py-2 border font-bold text-blue-600">R2</td><td className="px-3 py-2 border">LOB Analysis</td><td className="px-3 py-2 border text-center">{results[2]?.end || '-'} days</td><td className="px-3 py-2 border text-center">${r2BaseCost.toLocaleString()}</td><td className="px-3 py-2 border text-center">{DEFAULT_BUFFER} days</td></tr>
                  <tr className="bg-white"><td className="px-3 py-2 border font-bold text-blue-600">R3</td><td className="px-3 py-2 border">Buffer Analysis</td><td className="px-3 py-2 border text-center">{results[3]?.end || '-'} days</td><td className="px-3 py-2 border text-center">${r2BaseCost.toLocaleString()}</td><td className="px-3 py-2 border text-center">{results[3]?.buffer || '-'} days</td></tr>
                  <tr className="bg-gray-50"><td className="px-3 py-2 border font-bold text-orange-600">R4</td><td className="px-3 py-2 border">Rate Analysis</td><td className="px-3 py-2 border text-center">{results[4]?.end || '-'} days</td><td className="px-3 py-2 border text-center">${results[4]?.cost?.toLocaleString() || '-'}</td><td className="px-3 py-2 border text-center">{DEFAULT_BUFFER} days</td></tr>
                  <tr className={pass ? 'bg-green-50' : 'bg-yellow-50'}><td className="px-3 py-2 border font-bold text-purple-600">R5</td><td className="px-3 py-2 border">Optimization</td><td className={`px-3 py-2 border text-center font-bold ${results[5]?.end <= TARGET_DAYS ? 'text-green-600' : 'text-red-600'}`}>{results[5]?.end || '-'} days {results[5]?.end <= TARGET_DAYS ? '✅' : '❌'}</td><td className={`px-3 py-2 border text-center font-bold ${results[5]?.cost <= TARGET_COST ? 'text-green-600' : 'text-red-600'}`}>${results[5]?.cost?.toLocaleString() || '-'} {results[5]?.cost <= TARGET_COST ? '✅' : '❌'}</td><td className="px-3 py-2 border text-center">{results[5]?.buffer || '-'} days</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-2">💡 Notice: R1-R3 have the <strong>same cost</strong> because only buffer/timing changed, not equipment.</p>
          </div>

          {r5FirstAttempt && (r5FirstAttempt.end !== results[5]?.end || r5FirstAttempt.cost !== results[5]?.cost) && (
            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
              <h3 className="font-bold text-blue-800 mb-3">🔄 R5 Revision Improvement</h3>
              <p className="text-sm text-blue-700 mb-3">You went back and revised your R5 result. Here's the comparison:</p>
              <table className="w-full text-sm border-collapse">
                <thead><tr className="bg-blue-100"><th className="px-3 py-2 border"></th><th className="px-3 py-2 border text-center">1st Attempt</th><th className="px-3 py-2 border text-center">Final Result</th><th className="px-3 py-2 border text-center">Change</th></tr></thead>
                <tbody>
                  <tr>
                    <td className="px-3 py-2 border font-bold">Duration</td>
                    <td className={`px-3 py-2 border text-center ${r5FirstAttempt.end <= TARGET_DAYS ? 'text-green-600' : 'text-red-600'}`}>{r5FirstAttempt.end} days</td>
                    <td className={`px-3 py-2 border text-center font-bold ${results[5]?.end <= TARGET_DAYS ? 'text-green-600' : 'text-red-600'}`}>{results[5]?.end} days</td>
                    <td className={`px-3 py-2 border text-center font-bold ${results[5]?.end < r5FirstAttempt.end ? 'text-green-600' : results[5]?.end > r5FirstAttempt.end ? 'text-red-600' : 'text-gray-500'}`}>
                      {results[5]?.end < r5FirstAttempt.end ? `↓ ${r5FirstAttempt.end - results[5]?.end} days` : results[5]?.end > r5FirstAttempt.end ? `↑ ${results[5]?.end - r5FirstAttempt.end} days` : 'No change'}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 border font-bold">Cost</td>
                    <td className={`px-3 py-2 border text-center ${r5FirstAttempt.cost <= TARGET_COST ? 'text-green-600' : 'text-red-600'}`}>${r5FirstAttempt.cost?.toLocaleString()}</td>
                    <td className={`px-3 py-2 border text-center font-bold ${results[5]?.cost <= TARGET_COST ? 'text-green-600' : 'text-red-600'}`}>${results[5]?.cost?.toLocaleString()}</td>
                    <td className={`px-3 py-2 border text-center font-bold ${results[5]?.cost < r5FirstAttempt.cost ? 'text-green-600' : results[5]?.cost > r5FirstAttempt.cost ? 'text-red-600' : 'text-gray-500'}`}>
                      {results[5]?.cost < r5FirstAttempt.cost ? `↓ $${(r5FirstAttempt.cost - results[5]?.cost).toLocaleString()}` : results[5]?.cost > r5FirstAttempt.cost ? `↑ $${(results[5]?.cost - r5FirstAttempt.cost).toLocaleString()}` : 'No change'}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 border font-bold">Passed?</td>
                    <td className={`px-3 py-2 border text-center ${r5FirstAttempt.pass ? 'text-green-600' : 'text-red-600'}`}>{r5FirstAttempt.pass ? '✅ Yes' : '❌ No'}</td>
                    <td className={`px-3 py-2 border text-center font-bold ${results[5]?.pass ? 'text-green-600' : 'text-red-600'}`}>{results[5]?.pass ? '✅ Yes' : '❌ No'}</td>
                    <td className={`px-3 py-2 border text-center font-bold ${!r5FirstAttempt.pass && results[5]?.pass ? 'text-green-600' : ''}`}>
                      {!r5FirstAttempt.pass && results[5]?.pass ? '🎉 Improved!' : r5FirstAttempt.pass && !results[5]?.pass ? '⚠️ Regressed' : 'Same'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
            <h3 className="font-bold text-yellow-800">📚 What You Learned</h3>
            <ul className="mt-2 text-sm text-yellow-900 space-y-1">
              <li><strong>R1-R2:</strong> LOB visualizes crew progress & helps identify conflicts</li>
              <li><strong>R3:</strong> Buffer ↑ → Duration ↑, but Cost stays the <strong>same</strong></li>
              <li><strong>R4:</strong> Rate ↑ → Duration ↓, Cost may ↑ or ↓</li>
              <li><strong>R5:</strong> Balance equipment + buffer to meet <strong>both</strong> constraints</li>
            </ul>
          </div>

          <button onClick={() => {
            // Submit GameResults to Google Sheets
            const totalTime = Object.values(gameLog.rounds).reduce((sum, r) => sum + (r.timeSpent || 0), 0);
            submitToSheet('GameResults', {
              sessionId: gameLog.sessionId,
              anonymousId: preSurveyData?.anonymousId,
              r1Duration: results[1]?.end,
              r1ExcStart: results[1]?.excS,
              r1PipeStart: results[1]?.pipeS,
              r1BackStart: results[1]?.backS,
              r2Duration: results[2]?.end,
              r2Cost: r2BaseCost,
              r3Duration: results[3]?.end,
              r3Buffer: results[3]?.buffer,
              r4Duration: results[4]?.end,
              r4Cost: results[4]?.cost,
              r5Duration: results[5]?.end,
              r5Cost: results[5]?.cost,
              r5Buffer: results[5]?.buffer,
              r5Passed: results[5]?.pass ? 'Yes' : 'No',
              totalTimeMin: (totalTime / 60).toFixed(2),
              r1Time: gameLog.rounds[1]?.timeSpent || 0,
              r2Time: gameLog.rounds[2]?.timeSpent || 0,
              r3Time: gameLog.rounds[3]?.timeSpent || 0,
              r4Time: gameLog.rounds[4]?.timeSpent || 0,
              r5Time: gameLog.rounds[5]?.timeSpent || 0,
              backR2toR1: backCount.r2to1,
              backR3toR2: backCount.r3to2,
              backR4toR3: backCount.r4to3,
              backR5toR4: backCount.r5to4,
              backSummaryToR5: backCount.summaryTo5,
              r5FirstDuration: r5FirstAttempt?.end || results[5]?.end,
              r5FirstCost: r5FirstAttempt?.cost || results[5]?.cost,
              r5FirstBuffer: r5FirstAttempt?.buffer || results[5]?.buffer,
              r5FirstPassed: r5FirstAttempt ? (r5FirstAttempt.pass ? 'Yes' : 'No') : (results[5]?.pass ? 'Yes' : 'No'),
            });
            setRound(8);
          }} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold">Continue to Final Survey →</button>

          <button onClick={goBack} className="w-full mt-2 bg-blue-500 text-white py-3 rounded-lg font-bold hover:bg-blue-600">
            ← Go Back to R5 to Revise
          </button>
        </div>
      </div>
    );
  }

  // ==================== GAME ROUNDS (2-6 = R1-R5) ====================
  const gameRound = round - 1; // round 2=R1, 3=R2, 4=R3, 5=R4, 6=R5
  const titles = { 1: 'Bar Chart', 2: 'LOB Analysis', 3: 'Buffer Analysis', 4: 'Rate Analysis', 5: 'Optimize for Constraints' };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-blue-900 text-white py-2 px-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            {canGoBack && (
              <button onClick={goBack} className="px-3 py-1 bg-white text-blue-900 hover:bg-blue-100 rounded text-sm font-bold transition-all shadow-sm" title="Go back to revise previous round">
                ← Back
              </button>
            )}
            <span><span className="text-blue-300">Player:</span> <strong>{playerName}</strong></span>
          </div>
          <span className="font-bold">Round {gameRound}: {titles[gameRound]}</span>
          <div className="text-sm">🎯 ≤{TARGET_DAYS}d | 💰 ≤${TARGET_COST / 1000}K</div>
        </div>
      </div>

      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-2 flex gap-1">
          {[1, 2, 3, 4, 5].map(r => (
            <div key={r} className={`flex-1 h-2 rounded ${r < gameRound ? 'bg-green-500' : r === gameRound ? 'bg-blue-500' : 'bg-gray-200'}`} />
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-4">
        {/* R1: Bar Chart (round === 2, gameRound === 1) */}
        {gameRound === 1 && (
          <Round1 savedSchedule={r1Schedule} onComplete={(fullSchedule) => {
            setR1Schedule(fullSchedule);
            setResults(p => ({ ...p, 1: { round: 1, ...fullSchedule } }));
            completeRound(1, { excStart: fullSchedule.excS, excEnd: fullSchedule.excE, pipeStart: fullSchedule.pipeS, pipeEnd: fullSchedule.pipeE, backStart: fullSchedule.backS, backEnd: fullSchedule.backE, projectEnd: fullSchedule.end });
            setRound(3);
            if (3 > highestRound) setHighestRound(3);
          }} />
        )}

        {/* R2: LOB Analysis (round === 3, gameRound === 2) */}
        {gameRound === 2 && (() => {
          const r1ConflictList = findConflicts(r1Student, dur);
          const r1HasConflicts = r1ConflictList.length > 0;
          const r2Sched = r2Schedule ? { excS: r2Schedule.excS, excE: r2Schedule.excS + dur.exc - 1, pipeS: r2Schedule.pipeS, pipeE: r2Schedule.pipeS + dur.pipe - 1, backS: r2Schedule.backS, backE: r2Schedule.backS + dur.back - 1 } : null;
          const r2ConflictList = r2Sched ? findConflicts(r2Sched, dur) : [];
          const excOk = r2Schedule ? r2Schedule.excS === MOB_DAYS + 1 : false;
          const buf1 = r2Schedule ? r2Schedule.pipeS - r2Schedule.excS : 0;
          const buf1Ok = buf1 === DEFAULT_BUFFER;
          const buf2 = r2Sched ? r2Sched.backE - r2Sched.pipeE : 0;
          const buf2Ok = buf2 === DEFAULT_BUFFER;
          const noConflicts = r2ConflictList.length === 0;
          const allGreen = excOk && buf1Ok && buf2Ok && noConflicts;

          return (<>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <h3 className="font-bold text-lg">📋 Round 2: Analyze with Line of Balance (LOB)</h3>
            <p className="text-sm text-gray-600 mt-1">Your R1 schedule may have hidden conflicts. Use LOB to identify and fix them by applying a {DEFAULT_BUFFER}-day buffer between activities.</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-bold mb-2">📊 Your R1 Schedule</h3>
            <p className="text-sm text-gray-600 mb-3">Here is your schedule from Round 1. Compare the Bar Chart and LOB to see how the same schedule looks in each format.</p>
            <table className="w-full text-sm border mb-4">
              <thead className="bg-gray-100"><tr><th className="px-2 py-2 border text-left">Activity</th><th className="px-2 py-2 border text-center">Rate (ft/day)</th><th className="px-2 py-2 border text-center">Duration</th><th className="px-2 py-2 border text-center">Start</th><th className="px-2 py-2 border text-center">End</th></tr></thead>
              <tbody>
                <tr className="bg-gray-50"><td className="px-2 py-2 border">Mobilization</td><td className="px-2 py-2 border text-center">-</td><td className="px-2 py-2 border text-center">{MOB_DAYS}</td><td className="px-2 py-2 border text-center">1</td><td className="px-2 py-2 border text-center">{MOB_DAYS}</td></tr>
                <tr className="text-blue-700"><td className="px-2 py-2 border">Excavation & Bedding</td><td className="px-2 py-2 border text-center">{CREWS.exc.rate}</td><td className="px-2 py-2 border text-center">{dur.exc}</td><td className="px-2 py-2 border text-center font-bold">{r1Student.excS}</td><td className="px-2 py-2 border text-center font-bold">{r1Student.excE}</td></tr>
                <tr className="text-green-700"><td className="px-2 py-2 border">Pipe Laying & Alignment</td><td className="px-2 py-2 border text-center">{CREWS.pipe.rate}</td><td className="px-2 py-2 border text-center">{dur.pipe}</td><td className="px-2 py-2 border text-center font-bold">{r1Student.pipeS}</td><td className="px-2 py-2 border text-center font-bold">{r1Student.pipeE}</td></tr>
                <tr className="text-orange-700"><td className="px-2 py-2 border">Backfill & Compaction</td><td className="px-2 py-2 border text-center">{CREWS.back.rate}</td><td className="px-2 py-2 border text-center">{dur.back}</td><td className="px-2 py-2 border text-center font-bold">{r1Student.backS}</td><td className="px-2 py-2 border text-center font-bold">{r1Student.backE}</td></tr>
              </tbody>
            </table>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-lg p-3"><h4 className="font-bold text-sm mb-2 text-center">📊 Bar Chart</h4><BarChartR1 schedule={r1Student} /><div className="mt-2 text-center"><span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs rounded font-medium">✅ Looks fine?</span></div></div>
              <div className="border rounded-lg p-3"><h4 className="font-bold text-sm mb-2 text-center">📈 Line of Balance (LOB)</h4><LOBChartR1 schedule={r1Student} durations={dur} /></div>
            </div>
            <div className="mt-4 space-y-2">
              <FlashCard title="Why the difference?" icon="💡" isOpen={r2FlashCards.whyProblem} onToggle={() => setR2FlashCards(p => ({ ...p, whyProblem: !p.whyProblem }))}><ul className="space-y-1"><li>• <strong>Bar Chart:</strong> Shows only TIME (when activities happen)</li><li>• <strong>LOB:</strong> Shows TIME + LOCATION (where crews are along the pipeline)</li></ul></FlashCard>
              <FlashCard title="Why does this matter?" icon="⚠️" isOpen={r2FlashCards.whyMatter} onToggle={() => setR2FlashCards(p => ({ ...p, whyMatter: !p.whyMatter }))}><div className="space-y-2 text-sm"><p>In real construction, crews must work in sequence at every location.</p>{r1HasConflicts ? <p>Your LOB shows lines crossing — crews would collide on site.</p> : <p>Your LOB has no crossing yet, but without a buffer, any delay could cause a faster crew to catch up.</p>}<p>Buffers guarantee safe spacing between crews at all times.</p></div></FlashCard>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-bold mb-2">📈 Revise with Line of Balance (LOB)</h3>
            <p className="text-sm text-gray-600 mb-3">Now apply buffers to create a conflict-free schedule.</p>
            <div className="space-y-2 mb-4">
              <FlashCard title="What is LOB?" icon="📚" isOpen={r2FlashCards.whatIsLOB} onToggle={() => setR2FlashCards(p => ({ ...p, whatIsLOB: !p.whatIsLOB }))}><ul className="space-y-1"><li>• LOB plots <strong>Distance</strong> (Y-axis) vs <strong>Time</strong> (X-axis)</li><li>• Line slope = production rate (steeper = faster crew)</li><li>• <strong>Lines crossing = CONFLICT</strong></li><li>• <strong>Parallel lines = safe schedule</strong></li></ul></FlashCard>
              <FlashCard title="How to fix conflicts?" icon="🔧" isOpen={r2FlashCards.howToFix} onToggle={() => setR2FlashCards(p => ({ ...p, howToFix: !p.howToFix }))}><div className="space-y-2 text-sm"><p>Add <strong>BUFFERS</strong> — a minimum time gap between crews.</p><div className="bg-blue-50 p-2 rounded"><strong>Slower follows faster:</strong> Start = Prev Start + Buffer</div><div className="bg-orange-50 p-2 rounded"><strong>Faster follows slower:</strong> Start = Prev End + Buffer − Duration + 1</div></div></FlashCard>
              <FlashCard title="Assumptions" icon="📐" isOpen={r2FlashCards.assumptions} onToggle={() => setR2FlashCards(p => ({ ...p, assumptions: !p.assumptions }))}><ul className="space-y-1"><li>• Excavation starts on <strong>Day {MOB_DAYS + 1}</strong></li><li>• All activities must have a <strong>{DEFAULT_BUFFER}-day buffer</strong></li></ul></FlashCard>
              <FlashCard title="How to revise" icon="🎯" isOpen={r2FlashCards.howToRevise} onToggle={() => setR2FlashCards(p => ({ ...p, howToRevise: !p.howToRevise }))}><div className="space-y-2 text-sm"><p>Each line has a <strong>● handle</strong> at the bottom. Drag left/right to change the start day.</p><div className="bg-gray-50 rounded p-2 space-y-1"><div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-blue-500"></span> <strong>Step 1:</strong> Drag Excavation to Day {MOB_DAYS + 1}</div><div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-green-500"></span> <strong>Step 2:</strong> Drag Pipe Laying until buffer shows "{DEFAULT_BUFFER}d" green</div><div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-orange-500"></span> <strong>Step 3:</strong> Drag Backfill until buffer shows "{DEFAULT_BUFFER}d" green</div></div></div></FlashCard>
            </div>

            {r2Schedule && <DraggableLOBChart r1Schedule={r1Student} r2Schedule={r2Schedule} onR2Change={(newSched) => { setR2Schedule(newSched); setR2Validated(false); }} durations={dur} />}

            {r2Schedule && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                <div className={`p-3 rounded-lg border-2 text-center ${noConflicts ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-400'}`}><div className="font-bold text-sm">{noConflicts ? '✅' : '⊗'} Conflicts</div><div className="text-xs mt-1">{noConflicts ? 'No conflicts' : `${r2ConflictList.length} conflict${r2ConflictList.length > 1 ? 's' : ''}`}</div></div>
                <div className={`p-3 rounded-lg border-2 text-center ${excOk ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-400'}`}><div className="font-bold text-sm">{excOk ? '✅' : '❌'} Exc Start</div><div className="text-xs mt-1">Day {r2Schedule.excS}{excOk ? ' ✓' : ` (need ${MOB_DAYS + 1})`}</div></div>
                <div className={`p-3 rounded-lg border-2 text-center ${buf1Ok ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-400'}`}><div className="font-bold text-sm">{buf1Ok ? '✅' : '❌'} Exc → Pipe</div><div className="text-xs mt-1">{buf1} days{buf1Ok ? ' ✓' : ` (need ${DEFAULT_BUFFER})`}</div></div>
                <div className={`p-3 rounded-lg border-2 text-center ${buf2Ok ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-400'}`}><div className="font-bold text-sm">{buf2Ok ? '✅' : '❌'} Pipe → Back</div><div className="text-xs mt-1">{buf2} days{buf2Ok ? ' ✓' : ` (need ${DEFAULT_BUFFER})`}</div></div>
              </div>
            )}

            <div className="mt-4">
              <h4 className="font-bold text-sm mb-2">R2 Schedule (auto-updated from chart):</h4>
              <table className="w-full text-sm border">
                <thead className="bg-gray-100"><tr><th className="px-2 py-2 border text-left">Activity</th><th className="px-2 py-2 border text-center">Rate</th><th className="px-2 py-2 border text-center">Duration</th><th className="px-2 py-2 border text-center">Start</th><th className="px-2 py-2 border text-center">End</th></tr></thead>
                <tbody>
                  <tr className="bg-gray-50"><td className="px-2 py-2 border">Mobilization</td><td className="px-2 py-2 border text-center">-</td><td className="px-2 py-2 border text-center">{MOB_DAYS}</td><td className="px-2 py-2 border text-center">1</td><td className="px-2 py-2 border text-center">{MOB_DAYS}</td></tr>
                  <tr className="text-blue-700"><td className="px-2 py-2 border">Excavation & Bedding</td><td className="px-2 py-2 border text-center">{CREWS.exc.rate}</td><td className="px-2 py-2 border text-center">{dur.exc}</td><td className="px-2 py-2 border text-center font-bold">{r2Student.excS}</td><td className="px-2 py-2 border text-center font-bold">{r2Student.excE}</td></tr>
                  <tr className="text-green-700"><td className="px-2 py-2 border">Pipe Laying & Alignment</td><td className="px-2 py-2 border text-center">{CREWS.pipe.rate}</td><td className="px-2 py-2 border text-center">{dur.pipe}</td><td className="px-2 py-2 border text-center font-bold">{r2Student.pipeS}</td><td className="px-2 py-2 border text-center font-bold">{r2Student.pipeE}</td></tr>
                  <tr className="text-orange-700"><td className="px-2 py-2 border">Backfill & Compaction</td><td className="px-2 py-2 border text-center">{CREWS.back.rate}</td><td className="px-2 py-2 border text-center">{dur.back}</td><td className="px-2 py-2 border text-center font-bold">{r2Student.backS}</td><td className="px-2 py-2 border text-center font-bold">{r2Student.backE}</td></tr>
                </tbody>
              </table>
              <div className="mt-3 p-3 bg-blue-50 rounded text-center"><span className="text-gray-600">Project Duration:</span><span className="ml-2 text-xl font-bold text-blue-600">{r2Student.end} days</span></div>
            </div>

            {allGreen && (<>
              <div className="mt-4 bg-green-50 border-2 border-green-400 rounded-lg p-4">
                <h4 className="font-bold text-green-800 mb-2">💡 Key Insight</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• {DEFAULT_BUFFER}-day buffer keeps LOB lines parallel</li>
                  <li>• Pipe Laying (slowest at {CREWS.pipe.rate} ft/day) controls the project duration</li>
                  <li>• Backfill (fastest at {CREWS.back.rate} ft/day) must wait to avoid catching up</li>
                </ul>
                <div className="mt-3 pt-2 border-t border-green-300 text-sm text-green-600">👉 Round 3: See how buffer size affects duration.</div>
              </div>
              <div className="mt-3 p-3 bg-green-100 text-green-700 rounded">✅ Correct! All criteria met.</div>
            </>)}
          </div>

          {allGreen && (<>
            <div className="bg-white rounded-lg shadow p-4"><h3 className="font-bold mb-2">💰 Budget (Auto-Calculated)</h3><BudgetTable cost={r2Cost} durExc={dur.exc} durPipe={dur.pipe} durBack={dur.back} costExc={CREWS.exc.cost} costPipe={CREWS.pipe.cost} costBack={CREWS.back.cost} /></div>
          </>)}
          <div className="flex gap-3">
            <button onClick={goBack} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300">← Back to R1</button>
            {allGreen && <button onClick={nextRound} className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700">Complete R2 → R3</button>}
          </div>
          </>);
        })()}

        {/* R3: Buffer Analysis (round === 4, gameRound === 3) */}
        {gameRound === 3 && (<>
          <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
            <h3 className="font-bold text-lg">📋 R3: Buffer Analysis</h3>
            <p className="text-sm text-gray-700 mt-2">Adjust the buffer slider and observe:</p>
            <ul className="text-sm text-gray-700 mt-1 ml-4 list-disc"><li>How does the <strong>project duration</strong> change?</li><li>Does the <strong>total cost</strong> change?</li></ul>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-4"><span className="font-bold">Buffer:</span><input type="range" min="1" max="15" value={r3Buffer} onChange={e => { const v = +e.target.value; setR3Buffer(v); logValueChange(3, 'buffer', v); }} className="flex-1" /><span className="text-3xl font-bold text-green-600 w-16 text-center">{r3Buffer}</span><span>days</span></div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-bold mb-2">Schedule (Buffer = {r3Buffer} days)</h3>
            <table className="w-full text-sm border">
              <thead className="bg-gray-100"><tr><th className="px-2 py-2 border">Activity</th><th className="px-2 py-2 border">Rate</th><th className="px-2 py-2 border">Duration</th><th className="px-2 py-2 border">Start</th><th className="px-2 py-2 border">End</th></tr></thead>
              <tbody>
                <tr className="bg-gray-50"><td className="px-2 py-2 border">Mobilization</td><td className="px-2 py-2 border text-center">-</td><td className="px-2 py-2 border text-center">{MOB_DAYS}</td><td className="px-2 py-2 border text-center">1</td><td className="px-2 py-2 border text-center">{MOB_DAYS}</td></tr>
                <tr className="text-blue-700"><td className="px-2 py-2 border">Excavation & Bedding</td><td className="px-2 py-2 border text-center">{CREWS.exc.rate}</td><td className="px-2 py-2 border text-center">{dur.exc}</td><td className="px-2 py-2 border text-center">{r3.excS}</td><td className="px-2 py-2 border text-center">{r3.excE}</td></tr>
                <tr className="text-green-700"><td className="px-2 py-2 border">Pipe Laying & Alignment</td><td className="px-2 py-2 border text-center">{CREWS.pipe.rate}</td><td className="px-2 py-2 border text-center">{dur.pipe}</td><td className="px-2 py-2 border text-center">{r3.pipeS}</td><td className="px-2 py-2 border text-center">{r3.pipeE}</td></tr>
                <tr className="text-orange-700"><td className="px-2 py-2 border">Backfill & Compaction</td><td className="px-2 py-2 border text-center">{CREWS.back.rate}</td><td className="px-2 py-2 border text-center">{dur.back}</td><td className="px-2 py-2 border text-center">{r3.backS}</td><td className="px-2 py-2 border text-center">{r3.backE}</td></tr>
              </tbody>
            </table>
            <div className="mt-3 text-center">Project End: <strong className="text-2xl text-green-600">{r3.end} days</strong></div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-bold mb-2">LOB Comparison: R2 (dashed) vs R3 (solid)</h3>
            <ResponsiveContainer width="100%" height={280}><LineChart data={genLOB([r2Correct, r3])} margin={{ top: 10, right: 30, bottom: 30, left: 60 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" label={{ value: 'Duration (day)', position: 'insideBottom', offset: -5 }} /><YAxis domain={[0, PROJECT_LENGTH]} tickFormatter={v => (v/1000).toFixed(0)+'k'} label={{ value: 'Distance (ft)', angle: -90, position: 'insideLeft', offset: 10 }} /><Tooltip /><Legend verticalAlign="top" height={36} /><Line type="linear" dataKey="exc0" stroke="#2563eb" strokeWidth={1} strokeDasharray="5 5" name="Exc R2" dot={false} /><Line type="linear" dataKey="pipe0" stroke="#16a34a" strokeWidth={1} strokeDasharray="5 5" name="Pipe R2" dot={false} /><Line type="linear" dataKey="back0" stroke="#ea580c" strokeWidth={1} strokeDasharray="5 5" name="Back R2" dot={false} /><Line type="linear" dataKey="exc1" stroke="#2563eb" strokeWidth={3} name="Exc R3" dot={false} /><Line type="linear" dataKey="pipe1" stroke="#16a34a" strokeWidth={3} name="Pipe R3" dot={false} /><Line type="linear" dataKey="back1" stroke="#ea580c" strokeWidth={3} name="Back R3" dot={false} /></LineChart></ResponsiveContainer>
          </div>
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded"><h4 className="font-bold text-yellow-800">💡 Key Insight</h4><div className="mt-2 text-sm text-yellow-900 space-y-1"><p>Buffer ↑ → Duration ↑</p><p>Buffer ↑ → Cost stays the <strong>SAME</strong></p></div><p className="mt-3 text-sm text-yellow-800">Why? Buffer only shifts <em>when</em> crews work, not <em>how long</em> they work.</p></div>
          <div className="flex gap-3">
            <button onClick={goBack} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300">← Back to R2</button>
            <button onClick={nextRound} className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold">Complete R3 → R4</button>
          </div>
        </>)}

        {/* R4: Rate Analysis (round === 5, gameRound === 4) */}
        {gameRound === 4 && (<>
          <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded">
            <h3 className="font-bold text-lg">📋 R4: Rate Analysis</h3>
            <p className="text-sm text-gray-700 mt-2">Select different equipment for each crew and observe how rate affects duration and cost.</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-bold mb-3">Equipment Selection</h3>
            <div className="grid grid-cols-3 gap-4">
              {['exc', 'pipe', 'back'].map((type) => (<div key={type} className="border rounded p-3"><h4 className={`font-bold mb-2 ${type === 'exc' ? 'text-blue-700' : type === 'pipe' ? 'text-green-700' : 'text-orange-700'}`}>{type === 'exc' ? 'Excavation & Bedding' : type === 'pipe' ? 'Pipe Laying & Alignment' : 'Backfill & Compaction'}</h4>{EQUIPMENT[type].map((eq, i) => (<label key={i} className={`block p-2 rounded mb-1 cursor-pointer ${r4Eq[type] === i ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-50'}`}><input type="radio" checked={r4Eq[type] === i} onChange={() => { setR4Eq(p => ({...p, [type]: i})); logValueChange(4, `${type}Equipment`, eq.name); }} className="mr-2" />{eq.name}<div className="text-xs text-gray-500 ml-5">{eq.rate} ft/day | ${eq.cost}/day</div></label>))}</div>))}
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
            <ResponsiveContainer width="100%" height={280}><LineChart data={genLOB([r2Correct, r4])} margin={{ top: 10, right: 30, bottom: 30, left: 60 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" label={{ value: 'Duration (day)', position: 'insideBottom', offset: -5 }} /><YAxis domain={[0, PROJECT_LENGTH]} tickFormatter={v => (v/1000).toFixed(0)+'k'} label={{ value: 'Distance (ft)', angle: -90, position: 'insideLeft', offset: 10 }} /><Tooltip /><Legend verticalAlign="top" height={36} /><Line type="linear" dataKey="exc0" stroke="#2563eb" strokeWidth={1} strokeDasharray="5 5" name="Exc R2" dot={false} /><Line type="linear" dataKey="pipe0" stroke="#16a34a" strokeWidth={1} strokeDasharray="5 5" name="Pipe R2" dot={false} /><Line type="linear" dataKey="back0" stroke="#ea580c" strokeWidth={1} strokeDasharray="5 5" name="Back R2" dot={false} /><Line type="linear" dataKey="exc1" stroke="#2563eb" strokeWidth={3} name="Exc R4" dot={false} /><Line type="linear" dataKey="pipe1" stroke="#16a34a" strokeWidth={3} name="Pipe R4" dot={false} /><Line type="linear" dataKey="back1" stroke="#ea580c" strokeWidth={3} name="Back R4" dot={false} /></LineChart></ResponsiveContainer>
          </div>
          <div className="bg-white rounded-lg shadow p-4"><h3 className="font-bold mb-2">💰 R4 Budget</h3><BudgetTable cost={r4Cost} durExc={r4.excDur} durPipe={r4.pipeDur} durBack={r4.backDur} costExc={r4.excCost} costPipe={r4.pipeCost} costBack={r4.backCost} /></div>
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded"><h4 className="font-bold text-yellow-800">💡 Key Insight</h4><div className="mt-2 text-sm text-yellow-900 space-y-1"><p>Rate ↑ → Duration ↓</p><p>Rate ↑ → Cost may ↑ or ↓</p></div><p className="mt-3 text-sm text-yellow-800"><strong>The cheapest option is not always the slowest!</strong></p></div>
          <div className="flex gap-3">
            <button onClick={goBack} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300">← Back to R3</button>
            <button onClick={nextRound} className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold">Complete R4 → R5</button>
          </div>
        </>)}

        {/* R5: Optimization (round === 6, gameRound === 5) */}
        {gameRound === 5 && (<>
          <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded">
            <h3 className="font-bold text-lg">📋 R5: Optimization Challenge</h3>
            <p className="text-sm text-gray-700 mt-2">Meet <strong>BOTH</strong> constraints: Duration ≤{TARGET_DAYS} days, Cost ≤${TARGET_COST.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-bold mb-3">Equipment Configuration (Multiple Units)</h3>
            <div className="grid grid-cols-3 gap-4">
              {['exc', 'pipe', 'back'].map((type) => (<div key={type} className={`border rounded p-3 ${type === 'exc' ? 'bg-blue-50' : type === 'pipe' ? 'bg-green-50' : 'bg-orange-50'}`}><h4 className={`font-bold mb-2 ${type === 'exc' ? 'text-blue-700' : type === 'pipe' ? 'text-green-700' : 'text-orange-700'}`}>{type === 'exc' ? 'Excavation & Bedding' : type === 'pipe' ? 'Pipe Laying & Alignment' : 'Backfill & Compaction'}</h4>{Object.keys(r5Config[type]).map((key) => { const eq = EQUIPMENT[type][type === 'pipe' ? (key === 'standard' ? 0 : 1) : (key === 'small' ? 0 : key === 'standard' ? 1 : 2)]; return (<div key={key} className="flex items-center justify-between bg-white p-2 rounded mb-1"><div className="text-sm">{eq.name}<div className="text-xs text-gray-500">{eq.rate} ft/d | ${eq.cost}/d</div></div><div className="flex items-center gap-1"><button onClick={() => { const v = Math.max(0, r5Config[type][key] - 1); setR5Config(p => ({...p, [type]: {...p[type], [key]: v}})); logValueChange(5, `${type}_${key}`, v); }} className="w-6 h-6 bg-gray-200 rounded font-bold">-</button><span className="w-6 text-center font-bold">{r5Config[type][key]}</span><button onClick={() => { const v = r5Config[type][key] + 1; setR5Config(p => ({...p, [type]: {...p[type], [key]: v}})); logValueChange(5, `${type}_${key}`, v); }} className="w-6 h-6 bg-blue-200 rounded font-bold">+</button></div></div>); })}</div>))}
            </div>
            <div className="mt-4 p-3 bg-purple-50 rounded flex items-center gap-4"><span className="font-bold">Buffer:</span><input type="range" min="1" max="10" value={r5Buffer} onChange={e => { const v = +e.target.value; setR5Buffer(v); logValueChange(5, 'buffer', v); }} className="flex-1" /><span className="text-2xl font-bold text-purple-600 w-12">{r5Buffer}</span></div>
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
            <h3 className="font-bold mb-2">📈 R5 Line of Balance (LOB)</h3>
            <ResponsiveContainer width="100%" height={280}><LineChart data={genLOB([r5])} margin={{ top: 10, right: 30, bottom: 30, left: 60 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" label={{ value: 'Duration (day)', position: 'insideBottom', offset: -5 }} /><YAxis domain={[0, PROJECT_LENGTH]} tickFormatter={v => (v/1000).toFixed(0)+'k'} label={{ value: 'Distance (ft)', angle: -90, position: 'insideLeft', offset: 10 }} /><Tooltip /><Legend verticalAlign="top" height={36} /><Line type="linear" dataKey="exc0" stroke="#2563eb" strokeWidth={3} name="Excavation & Bedding" dot={false} /><Line type="linear" dataKey="pipe0" stroke="#16a34a" strokeWidth={3} name="Pipe Laying & Alignment" dot={false} /><Line type="linear" dataKey="back0" stroke="#ea580c" strokeWidth={3} name="Backfill & Compaction" dot={false} /></LineChart></ResponsiveContainer>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-bold mb-2">Constraints Check</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className={`p-4 rounded-lg text-center ${r5.end <= TARGET_DAYS ? 'bg-green-100 border-2 border-green-500' : 'bg-red-100 border-2 border-red-500'}`}><div className="text-gray-600">Duration</div><div className={`text-3xl font-bold ${r5.end <= TARGET_DAYS ? 'text-green-600' : 'text-red-600'}`}>{r5.end} days</div><div className="text-sm">Target: ≤{TARGET_DAYS} {r5.end <= TARGET_DAYS ? '✅' : '❌'}</div></div>
              <div className={`p-4 rounded-lg text-center ${r5Cost.total <= TARGET_COST ? 'bg-green-100 border-2 border-green-500' : 'bg-red-100 border-2 border-red-500'}`}><div className="text-gray-600">Total Cost</div><div className={`text-3xl font-bold ${r5Cost.total <= TARGET_COST ? 'text-green-600' : 'text-red-600'}`}>${(r5Cost.total/1000).toFixed(0)}K</div><div className="text-sm">Target: ≤${TARGET_COST/1000}K {r5Cost.total <= TARGET_COST ? '✅' : '❌'}</div></div>
            </div>
            {(r5.end > TARGET_DAYS || r5Cost.total > TARGET_COST) && <div className="mt-3 p-3 bg-yellow-100 border border-yellow-400 rounded text-yellow-800 font-bold text-center">⚠️ Keep optimizing...</div>}
          </div>
          <div className="bg-white rounded-lg shadow p-4"><h3 className="font-bold mb-2">💰 R5 Budget</h3><BudgetTable cost={r5Cost} durExc={r5.excDur} durPipe={r5.pipeDur} durBack={r5.backDur} costExc={r5.excCost} costPipe={r5.pipeCost} costBack={r5.backCost} /></div>
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded"><h4 className="font-bold text-yellow-800">💡 Key Insight</h4><p className="text-sm text-yellow-900 mt-2">More equipment → Faster but costs more. Smaller buffer → Faster but riskier. <strong>Find the balance!</strong></p></div>
          <div className="flex gap-3">
            <button onClick={goBack} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300">← Back to R4</button>
            <button onClick={nextRound} className="flex-1 bg-purple-600 text-white py-3 rounded-lg font-bold">Finish Game 🏆</button>
          </div>
        </>)}
      </div>
    </div>
  );
}
