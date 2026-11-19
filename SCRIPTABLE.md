# Scriptable widgets

1. In ENDGAME, open **Developer Terminal** and create a read-only key.
2. Copy the key when it appears. Scriptable only needs the key and your deployed Netlify base URL.
3. In Scriptable, add the key to Keychain once (the widget script prompts on first run), then create a widget script from one of the examples in `scriptable/`.
4. Add a Scriptable widget to the Home Screen and select the script. Choose small, medium, or large where the script supports the space.

The examples cache their last successful JSON response in Scriptable's local file storage. If the network is unavailable, they show the cached values with an offline indicator. iOS decides when widgets refresh, so updates can be delayed.

Set `ENDGAME_BASE_URL` to your site origin without a trailing slash if you want a custom URL. On first run, the script prompts for the base URL and API key and stores the key in Scriptable Keychain. Never share a widget script with the key embedded in it.

Included scripts:

- `scriptable/mission-progress.js` — mission percent, days and streak
- `scriptable/todo-list.js` — open to-do list, with due dates and offline cache
- `scriptable/study-statistics.js` — today's and weekly hours, rating, and seven-day bars
