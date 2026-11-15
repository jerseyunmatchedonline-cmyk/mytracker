# Study & Diet Tracker

A modern, local dashboard combining a **Study Tracker & Pomodoro Timer** with a **Diet & Calorie Tracker**, backed by a local SQLite database. All data stays entirely on your computer.

---

## Features

### 1. Welcome & Navigation
- **Personalized Header**: Greets you with *"Welcome back, Sanket"* along with real-time summary pills for total study time and daily calorie intake.
- **Tab Navigation**: Clean, accessible tabs to quickly switch between the **Study** and **Diet** views.
- **Dark Mode UI**: Modern dark theme with soft indigo accents, smooth transitions, and tabular stats.

### 2. Study Tracker & Pomodoro
- **Interactive Pomodoro Timer**:
  - Animated SVG circular progress ring.
  - Controls: Start, Pause, Reset.
  - Automatically alternates: Work (25 min) -> Break (5 min) -> Long Break (15 min after 4 cycles).
  - Audio chime on completion using the Web Audio API.
  - Automatically logs the study session under the currently active subject upon completion.
- **Configurable Intervals**: Adjust Work, Short Break, and Long Break durations directly from the UI.
- **Dynamic Subjects**:
  - Add new subjects with custom color pickers.
  - Select active subjects with interactive chips.
  - Delete subjects (and cascade-remove associated sessions).
- **Session Logging**:
  - Manual logging for off-timer study sessions.
  - Chronological history of all completed sessions with subject color indicators and durations.
  - Lifetime total study time counter.

### 3. Diet & Calorie Tracker
- **Online Nutrition Lookup**:
  - Enter any food item (e.g. *banana*, *chicken breast*, *granola bar*).
  - Automatically queries the **Open Food Facts API** for live nutritional info (calories, protein, carbs, fat, serving size).
  - Built-in curated fallback database for instant offline results.
  - One-click button to log the queried item into today's meals.
- **Manual Logging**: Quickly log foods with custom calorie counts.
- **Daily Summaries & Macros**:
  - Live progress bar towards a 2,000 kcal daily goal.
  - Macro breakdowns for Protein, Carbs, and Fat.
  - Today's itemized food intake history with timestamps.

---

## Tech Stack
- **Backend**: Node.js, Express
- **Database**: SQLite via `better-sqlite3` (WAL mode enabled)
- **Frontend**: Vanilla HTML5, CSS3, ES6+ (no heavy frontend framework dependencies)
- **External API**: Open Food Facts public API (no API key required)

---

## Setup & Running Locally

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)

### 1. Install dependencies
```bash
cd study-tracker
npm install
```

### 2. Start the server
```bash
npm start
```
Or run directly:
```bash
node server.js
```

### 3. Open in your browser
Navigate to:
```
http://localhost:3000
```

All data is stored persistently in `data/app.db`.
