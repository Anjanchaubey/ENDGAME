# ENDGAME

ENDGAME is a personal study and productivity command center built around a 90-day mission. It combines daily study journals, a to-do list, notes, progress summaries, and a phone-friendly interface with a black-and-yellow palette.

## Features

- **Command Center:** today’s journal status, mission progress, study hours, current and best streaks, average rating, and upcoming to-dos.
- **90-day mission:** browse three 30-day phases, select a day to see its journal details, and update hours, topics, notes, rating, and status.
- **To-do list:** create, search, filter, complete, and review to-dos.
- **Todoist sync:** connect a Todoist account in Account & Settings; tasks sync in both directions while ENDGAME is open.
- **Study notes:** save notes and optional file attachments.
- **Progress:** review study hours, ratings, streaks, and mission completion.
- **Account and export:** download a complete JSON backup of all 90 mission days, settings, to-dos, notes, and note attachments, or a CSV summary.
- **Scriptable API:** optional read-only API keys for personal widgets. See [API.md](API.md) and [SCRIPTABLE.md](SCRIPTABLE.md).
- **Responsive navigation:** desktop sidebar and phone tab bar; the phone layout stacks forms and controls for narrow screens.

## Requirements

- Node.js 20 or later
- A Firebase project with Authentication, Cloud Firestore, and Firebase Storage enabled

## Run locally

```bash
npm install
Copy-Item .env.example .env.local
```

Add your Firebase web app settings to `.env.local`, then start the development server:

```bash
npm run dev
```

Open the local URL printed by Vite, usually <http://localhost:5173>.

### Test on a phone

Connect the phone and development computer to the same Wi-Fi network. Start Vite so it accepts local network connections:

```bash
npm run dev -- --host 0.0.0.0
```

On the phone, open `http://<computer-ip-address>:5173`. Use your computer’s local IPv4 address in place of `<computer-ip-address>`. If Windows asks, allow the development server on your private network.

## Firebase setup

1. Create a Firebase project and register a Web app.
2. Enable **Email/Password** and **Google** sign-in providers in Firebase Authentication. Add `localhost` and your deployed hostname to the authorized domains.
3. Create a Cloud Firestore database and a Firebase Storage bucket.
4. Copy `.env.example` to `.env.local` and set the six `VITE_FIREBASE_*` values from the Firebase Web app configuration.
5. Deploy or paste in `firestore.rules`, `firestore.indexes.json`, and `storage.rules`.

The `VITE_FIREBASE_*` values configure the browser SDK; access to user data is controlled by Firebase Authentication and the security rules. Never put a Firebase Admin service account in a `VITE_` variable or commit `.env.local`.

If Firebase settings are missing, the app shows a setup screen rather than sample data.

## Build and preview

```bash
npm run typecheck
npm run build
npm run preview
```

Vite prints the preview address, usually <http://localhost:4173>. To open the production preview from a phone on the same Wi-Fi, use:

```bash
npm run preview -- --host 0.0.0.0
```

## Deploy to Netlify

Connect the project to Netlify. [`netlify.toml`](netlify.toml) configures the build command, `dist` publish directory, API function routing, and single-page app routing.

Set the six `VITE_FIREBASE_*` variables from `.env.example` as Netlify build variables. For the optional API, set these function variables in Netlify:

- `FIREBASE_SERVICE_ACCOUNT_JSON`: service account JSON stored as a single-line secret. Keep it out of browser build variables and source control.
- `ALLOWED_ORIGIN`: the exact deployed site origin, without a trailing slash.

Todoist does not need another Netlify variable. Each signed-in user connects their own personal Todoist API token in **Account & Settings**. ENDGAME encrypts the token on the server. Tasks created or changed in ENDGAME are sent to Todoist immediately; changes made in Todoist are checked about once a minute while ENDGAME is open. Todoist tokens are available in Todoist **Settings → Integrations → Developer**.

Add production and preview hostnames to Firebase Authentication’s authorized domains.

## Data and privacy

- Each signed-in user’s records are stored under `users/{uid}` and protected by the included Firestore and Storage rules.
- Journals, to-dos, notes, and settings sync through Firebase.
- The JSON backup is generated in the browser from the signed-in user’s loaded records. Note attachments are included as data URLs inside the JSON file.
- API keys are shown once, stored as SHA-256 hashes, and can be revoked. API endpoints are read-only; see [API.md](API.md).

## Project files

- `src/` — React app, Firebase client setup, and UI styles
- `netlify/functions/` — optional personal API and API key management
- `firestore.rules`, `storage.rules`, `firestore.indexes.json` — Firebase access controls and indexes
- `scriptable/`, `SCRIPTABLE.md`, `API.md` — widget scripts and API documentation
- `apple_design/` — design references used for the interface
