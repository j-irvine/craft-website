# Craft Website — Project Brief

Brief from Craft Pilates, Oct 29, 2026. Keep this file updated as decisions are made (see **Decisions** at the bottom).

## What this project is

Craft Website builds code-powered sections for craftpilates.com and embeds them into our existing Showit site. It does not rebuild or replace the site.

- Craft Pilates is a boutique group reformer Pilates studio with two NYC locations: Park Slope (Brooklyn) and the Upper West Side.
- Our web designer built the site on Showit. We like the design and want to keep making small edits ourselves in Showit's editor.
- Booking currently runs on Arketa, embedded on the site.
- Sister project: Craft Apps (`j-irvine/studio-app`), our studio app, also built with Claude Code.

## How code reaches the Showit site

Showit has no API or code export, so this project hosts each component and Showit holds only a short embed snippet that rarely changes.

- Showit accepts custom code through an Embed Code element placed on a page, page-level JavaScript in a page's Advanced Settings, and site-wide code in Site Settings.
- Pattern: we paste a one-line snippet (script tag or iframe) into Showit once. After that, changes deploy from this repo without opening Showit.
- Embed boxes are fixed-size, and Showit has separate desktop and mobile layouts, each sized by hand. Components must fit a fixed-height box and work at phone width.
- Match the designer's look: take fonts and colors from the live site (cream panels, rust headings, dark brown background, green accents). It should read as part of the original design.
- For every component, give us plain step-by-step Showit instructions: where to add the element, what to paste, and how to size it on desktop and mobile.
- Check that our Showit plan allows custom embed code; some plans require an upgrade.

## First feature: Find Your Person

Replace the instructor carousel on both privates pages with a filterable directory, so clients pick a private-session instructor by specialty without emailing us.

- Today, craftpilates.com/private-sessions-park-slope and /private-sessions-upper-west-side show a one-at-a-time carousel: photo, name, and a few words such as "Flowing, rigorous sessions blending dance and Pilates."
- Problems: it goes out of date as instructors change, and the blurbs are too vague to choose by. Clients want someone who specializes in something specific.
- Reference: an internal dashboard we made in ChatGPT already displays this data for staff. We'll share screenshots or its code. The public version should be simpler and filter-first.

### Instructor data

The website reads the responses sheet of a Google Form that every new instructor fills out, so new instructors appear without anyone touching the site.

- The form collects specialties (a dozen or so options), certifications, and years teaching.
- We're adding a question on which locations they're available for privates (Park Slope, UWS) and will fill that in by hand for existing respondents.
- Maayan (co-owner, runs operations) sends the form to every new instructor.
- Add a "Hide from website" checkbox column to the responses sheet. Unchecked by default, so new responses show automatically. Checking it hides that instructor; unchecking brings them back. It must be easy to do from the Google Sheets phone app.
- If someone stops doing privates at one location only, Maayan edits their location answer in the sheet.
- If an instructor submits the form more than once, use their most recent response, matched by email.
- Privacy: publish only fields meant for clients. Read the sheet with a service account; never make the raw responses sheet public.
- Specialty labels become claims the studio makes publicly. We'll review the wording before launch, especially clinical-sounding ones like injury rehab or prenatal.

### Photos

Photos come from our existing onboarding bot, which already saves the photo each new instructor emails us into Google Drive.

- We'll have the bot also save a copy into a dedicated website-photos folder, named by the instructor's form email. If the email they write from can differ from their form email, the bot writes the photo's link into their sheet row instead.
- The backend copies new photos from that folder, crops them to a consistent shape, and serves them itself. Don't load images straight from Drive links.
- Share the folder with the website's service account; it stays private.
- Where we have a professional shoot photo (the current carousel uses these), it overrides the emailed one.
- Show a tasteful placeholder for instructors with no photo yet.

### Client experience and booking

One component, used on both privates pages, shows that location's instructors with specialty filters and a clear way into booking.

- Specialty filter chips at the top. Location is fixed per page by a setting in the embed snippet.
- Each card: photo, name, specialty tags, certifications, years teaching. A short bio only if we add one to the form.
- The layout must fit a fixed-height box. A horizontal scroller with filter chips above it fits well and echoes the current carousel.
- Booking today: Arketa embeds below the directory, split by session type (Privates, Duets), with URLs like `app.arketa.co/iframe/craftpilates/privates/by-service/<id>`.
  - Find out whether Arketa supports a privates embed or link filtered to one instructor. Arketa's help center has an MCP server at https://help.arketa.com/mcp; otherwise ask Arketa support.
  - If it does, "Book with [name]" loads that instructor's availability.
  - If not, "Book with [name]" scrolls to the Arketa embed and tells the client to choose that instructor.
- Later, when our own booking system replaces Arketa, the directory links straight to real availability.

## How we like to work

- Nothing goes on the live site without a preview and our OK.
- We aren't web developers. Explain Showit steps plainly.
- Keep the designer's look. Don't propose redesigning Showit pages.
- Maayan should be able to manage instructors entirely from the sheet, without opening this project.
- This repo is **public**. Never commit service account keys, sheet IDs paired with credentials, or raw instructor responses. Secrets live in the hosting provider's secret store.

## Decisions

Open decisions from the brief. Each has a proposal; none are confirmed yet. Update the status here when Craft Pilates confirms.

| Decision | Proposal | Status |
| --- | --- | --- |
| Where to host the components | Cloudflare Workers, same as Craft Apps (`studio-app` deploys with Wrangler and already signs in to Google with a service account in `worker/push.ts`). A Worker serves the embed script/iframe, a JSON API, and photos (R2). | Proposed |
| How data refreshes; how fast a hidden instructor disappears | A cron in the Worker reads the sheet every 5 minutes and caches the cleaned, client-safe list. Hiding takes effect within about 5 minutes. | Proposed |
| Field mapping from the form's columns | Needs the sheet. | Waiting on sheet |
| Photo matching | Support both: filename by form email first, then a photo link column in the row. Pro shoot photos override both. | Proposed |
| Short client-facing bio question | Yes, optional, 1–2 sentences, so cards aren't just tags. | Proposed |
| Can Arketa filter privates by instructor? | Not yet checked. | Open |
| Does the Showit plan support custom embed code? | Needs a check of the Showit account. | Open |
