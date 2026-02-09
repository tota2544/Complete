# 🎮 LOB Simulation Game - Student Version with Surveys

Interactive educational game for learning Line of Balance (LOB) scheduling, with built-in Pre and Post surveys for research data collection.

## 📋 Game Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐
│   INTRO     │ -> │ PRE-SURVEY  │ -> │   GAME ROUNDS (R1-R5)   │
│  (round 0)  │    │  (round 1)  │    │    (rounds 2-6)         │
└─────────────┘    └─────────────┘    └─────────────────────────┘
                                                 │
                                                 v
┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐
│  THANK YOU  │ <- │ POST-SURVEY │ <- │    GAME SUMMARY         │
│  (round 9)  │    │  (round 8)  │    │    (round 7)            │
└─────────────┘    └─────────────┘    └─────────────────────────┘
```

## 📊 Survey Structure

### Pre-Survey (collected before game)
- **Demographics**: Student ID, Name, Program, Major, Prior courses, LOB familiarity
- **Knowledge (K1-K8)**: 8 multiple choice questions about LOB concepts
- **Self-Efficacy (SE1-SE4)**: 4 confidence rating questions (1-5 scale)

### Post-Survey (collected after game)
- **Knowledge (K1-K8)**: Same 8 questions (to measure learning gain)
- **Self-Efficacy (SE1-SE4)**: Same 4 questions (to measure confidence gain)
- **Experience (EX1-EX6)**: 6 questions about game experience (1-5 scale)
- **Comments**: Open text field for feedback

## 🔧 Setup Instructions

### 1. Deploy to Vercel
1. Push this code to a GitHub repository
2. Import to [vercel.com](https://vercel.com)
3. Click "Deploy"
4. Done! Share URL with students

### 2. Setup Google Sheets Data Collection (Optional)
1. Create a new Google Sheet with 3 tabs:
   - `Pre-Survey`
   - `Game-Results`
   - `Post-Survey`

2. Go to Extensions > Apps Script

3. Paste this code:
```javascript
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  const data = JSON.parse(e.postData.contents);
  
  let tab;
  if (data.type === 'pre-survey') {
    tab = sheet.getSheetByName('Pre-Survey');
  } else if (data.type === 'game-results') {
    tab = sheet.getSheetByName('Game-Results');
  } else if (data.type === 'post-survey') {
    tab = sheet.getSheetByName('Post-Survey');
  }
  
  if (tab) {
    // Add headers if first row
    if (tab.getLastRow() === 0) {
      tab.appendRow(Object.keys(data));
    }
    tab.appendRow(Object.values(data));
  }
  
  return ContentService.createTextOutput('OK');
}
```

4. Deploy as Web App:
   - Execute as: Me
   - Who has access: Anyone
   - Copy the URL

5. Update `GOOGLE_SCRIPT_URL` in `src/App.js`:
```javascript
const GOOGLE_SCRIPT_URL = 'YOUR_DEPLOYED_URL_HERE';
```

## 📁 Project Structure

```
lob-game-final/
├── package.json
├── README.md
├── public/
│   └── index.html
└── src/
    ├── index.js
    └── App.js          # Main application with all components
```

## ⚙️ Configuration

Edit constants at the top of `src/App.js`:

```javascript
const PROJECT_LENGTH = 15840;    // Total pipeline length (ft)
const MOB_DAYS = 14;             // Mobilization days
const TARGET_DAYS = 55;          // Target duration constraint
const TARGET_COST = 550000;      // Target cost constraint
```

## 📈 Data Collected

### Session Tracking
- Unique Session ID (links all data for one player)
- Timestamps for each submission
- Round completion times

### Metrics Computed
- Knowledge Score: Count of correct answers (0-8)
- Self-Efficacy Score: Mean of SE1-SE4 ratings (1.00-5.00)
- Experience Score: Mean of EX1-EX6 ratings (1.00-5.00)
- Learning Gain: Post score - Pre score

---

Created for Construction Scheduling Education Research
