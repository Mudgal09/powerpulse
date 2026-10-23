# Friction Log: PowerPulse

Honest notes from building PowerPulse (Alexa+ track, self-hosted MCP server). Format: task, steps, expected vs actual, severity, workaround, suggestion.

## 1. Finding the Devpost submission requirements late
- **Task:** Submit the project on Devpost.
- **Steps:** Built and deployed first, then opened the submission form on deadline day.
- **Expected:** A short checklist of what a valid submission needs.
- **Actual:** Several requirements only appeared on the final "additional info" page: an open-source license file in the public repo, a code repository with run instructions, and track-specific feedback questions.
- **Severity:** Medium (cost me time on the last day).
- **Workaround:** Added a LICENSE and README the same day.
- **Suggestion:** Show a requirements checklist (license, README, demo video length, feedback questions) at the top of the submission flow.

## 2. MongoDB Atlas: confusing error when creating a read-only user
- **Task:** Create a user with read access to one database.
- **Steps:** Chose "Specific Privileges", selected `read` on my database, left a second empty privilege row.
- **Expected:** The empty row to be ignored.
- **Actual:** Error "includes role that doesn't exist: @", which did not point to the empty row.
- **Severity:** Low.
- **Workaround:** Deleted the empty row.
- **Suggestion:** Ignore empty rows or say "remove the empty privilege row".

## 3. Render: environment variable form
- **Task:** Add `ALLOWED_ORIGINS` to a Render web service.
- **Steps:** Used the Environment page in the dashboard.
- **Expected:** One variable named `ALLOWED_ORIGINS`.
- **Actual:** I typed the column headings "KEY" and "VALUE" as real variable names, so the app saw no `ALLOWED_ORIGINS` and my own page got 403 errors.
- **Severity:** Medium.
- **Workaround:** Deleted the two wrong rows and re-added the variable. I also changed the app to allow Render's own URL automatically.
- **Suggestion:** Make the name and value boxes clearer in the form.

## 4. MCP endpoint looks broken in a browser
- **Task:** Check that the deployed MCP endpoint is alive.
- **Steps:** Opened `/mcp` in a browser.
- **Expected:** Some sign of life.
- **Actual:** `Method not allowed` (a correct response, since MCP uses POST), which looks like a failure to a newcomer.
- **Severity:** Low.
- **Workaround:** Added a `/health` route and a README curl example.
- **Suggestion:** MCP quickstarts could mention that opening the endpoint in a browser is expected to fail and show a curl check instead.

## 5. Alexa+ connection
- **Status:** I built and tested the MCP server against a real MCP client and curl, and a web page that simulates the experience. I did not test it with a live Alexa+ device or account before the deadline.
- **Notes on the Alexa+ docs and quickstart:** *(add your own notes here before you submit, or delete this section)*
