# ENDGAME API v1

Base URL: `https://YOUR-SITE.netlify.app/api/v1`

All data routes require a personal API key in the Authorization header:

```http
Authorization: Bearer eg_live_…
```

Keys have read permission only. The API never accepts a client-supplied user ID; the key hash determines the owning account. Requests are throttled per key (60 per minute). Use HTTPS and keep keys in a secure client keychain.

## Read endpoints

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/mission` | 90-day completion counts, today's figures, average rating |
| GET | `/today` | Today's journal and open tasks due today or earlier |
| GET | `/tasks` | Open tasks, ordered by due date |
| GET | `/tasks/history` | Tasks created or completed in the last 10 days |
| GET | `/analytics/weekly` | Seven daily study hour and rating values |

Errors have a stable JSON shape, for example `{"error":"Authorization required"}`. A `429` response means the client should wait before retrying. The API does not promise immediate iOS widget refresh; iOS controls refresh scheduling.

## Key management

`POST /keys` (JSON `{ "name": "iPhone widget" }`), `GET /keys`, and `DELETE /keys/{keyId}` use a Firebase ID token from a signed-in browser session, rather than an API key. Creation returns the secret once. ENDGAME stores only its SHA-256 hash in `users/{uid}/apiKeys/{keyId}`. Revoke a key to prevent future calls. Do not store API keys in source control or logs.

## Example: mission response

```json
{
  "mission": { "total_days": 90, "completed_days": 0, "remaining_days": 90, "progress": 0 },
  "today": { "study_hours": 0, "rating": null, "tasks_completed": 0, "tasks_pending": 0 },
  "current_streak": 0,
  "average_rating": 0
}
```

Values above illustrate the response shape. Responses contain the authenticated user's actual records.
