# 🎮 LOB Simulation Game with Pre/Post Surveys

Educational game for learning Line of Balance (LOB) scheduling, with integrated surveys for research data collection.

## 📋 Round Flow (10 screens)

| Round | Screen | Description |
|-------|--------|-------------|
| 0 | Intro | Project overview, crew info, "Begin Survey →" |
| 1 | Pre-Survey | Demographics, Knowledge (K1-K8), Self-Efficacy (SE1-SE4) |
| 2 | R1: Bar Chart | Duration calculation + schedule building |
| 3 | R2: LOB Analysis | Draggable LOB chart with buffer adjustments |
| 4 | R3: Buffer Analysis | Explore buffer effects on duration |
| 5 | R4: Rate Analysis | Equipment selection impact |
| 6 | R5: Optimization | Meet duration + cost constraints |
| 7 | Game Summary | Results table + Key Learning Insights |
| 8 | Post-Survey | Knowledge, Self-Efficacy, Experience (EX1-EX6) |
| 9 | Thank You | Simple thank you (no scores shown to student) |

## 📊 Google Sheets Integration

### Step 1: Create Google Apps Script

1. Go to [script.google.com](https://script.google.com)
2. Create a new project
3. Replace the code with:

```javascript
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  const data = JSON.parse(e.postData.contents);
  
  let targetSheet;
  if (data.type === 'pre-survey') {
    targetSheet = sheet.getSheetByName('PreSurvey') || sheet.insertSheet('PreSurvey');
  } else if (data.type === 'game-results') {
    targetSheet = sheet.getSheetByName('GameResults') || sheet.insertSheet('GameResults');
  } else if (data.type === 'post-survey') {
    targetSheet = sheet.getSheetByName('PostSurvey') || sheet.insertSheet('PostSurvey');
  }
  
  // Add headers if first row
  if (targetSheet.getLastRow() === 0) {
    const headers = Object.keys(flattenObject(data));
    targetSheet.appendRow(headers);
  }
  
  // Add data row
  const values = Object.values(flattenObject(data));
  targetSheet.appendRow(values);
  
  return ContentService.createTextOutput(JSON.stringify({success: true}))
    .setMimeType(ContentService.MimeType.JSON);
}

function flattenObject(obj, prefix = '') {
  const result = {};
  for (const key in obj) {
    const newKey = prefix ? `${prefix}_${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(result, flattenObject(obj[key], newKey));
    } else {
      result[newKey] = JSON.stringify(obj[key]);
    }
  }
  return result;
}
```

4. Deploy → New deployment → Web app
5. Set "Execute as: Me" and "Who has access: Anyone"
6. Copy the URL

### Step 2: Update App.js

Replace this line in `src/App.js`:
```javascript
const GOOGLE_SCRIPT_URL = 'YOUR_GOOGLE_SCRIPT_URL_HERE';
```

With your actual URL:
```javascript
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';
```

## 🚀 Deployment to Vercel

1. Push this folder to GitHub
2. Import repository on [vercel.com](https://vercel.com)
3. Click "Deploy"
4. Share URL with students

## 📁 Project Structure

```
lob-game-survey/
├── package.json
├── README.md
├── public/
│   └── index.html
└── src/
    ├── index.js
    └── App.js
```

## ⚙️ Customization

Edit constants at the top of `src/App.js`:

```javascript
const PROJECT_LENGTH = 15840;    // Total length (ft)
const MOB_DAYS = 14;             // Mobilization days
const TARGET_DAYS = 55;          // Target duration
const TARGET_COST = 550000;      // Target cost
```

## 📈 Data Collected

### Pre-Survey (Round 1)
- Session ID, timestamp
- Demographics: Student ID, Name, Program, Major, Prior courses, LOB familiarity
- Knowledge quiz (K1-K8): 8 multiple choice + score (0-8)
- Self-Efficacy (SE1-SE4): 4 Likert scale + mean (1.00-5.00)

### Game Results (Round 7)
- Session ID, timestamp, Student ID
- R1-R5 schedules, durations, costs
- Equipment configurations
- Pass/fail status

### Post-Survey (Round 8)
- Session ID, timestamp, Student ID
- Knowledge (K1-K8): score + **gain** (post - pre)
- Self-Efficacy (SE1-SE4): mean + **gain** (post - pre)
- Experience (EX1-EX6): mean (1.00-5.00)
- Comments

---

Created for Construction Scheduling Education Research
