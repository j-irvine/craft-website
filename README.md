# Craft Website

Components for craftpilates.com, hosted on a Cloudflare Worker and embedded in the Showit site with one line each. The brief and decisions are in `CLAUDE.md`.

## Find Your Person

The instructor directory for the two privates pages.

```html
<script src="https://<worker address>/find-your-person.js" data-location="park-slope"></script>
```

`data-location` is `park-slope` or `uws`. `data-theme` matches the section the embed sits on: leave it out for cream (the privates pages), or use `chocolate` or `forest`.

## Run it

```sh
npm install
npm test            # sheet mapping tests
npm run typecheck
FONT_DIR=<studio-app>/brand/fonts/Type npm run preview   # dist/preview-park-slope.html, made-up instructors, brand fonts inlined
npm run dev         # local Worker (needs .dev.vars with GOOGLE_SERVICE_ACCOUNT and SHEET_ID)
```

The Worker's pages: `/find-your-person.js` (the embed), `/api/instructors?location=park-slope`, `/api/status` (last update, how many shown, rows staff should fix), `/preview?location=uws` (the directory in Showit-sized boxes, with live data).

## Set up (once)

1. A Google Cloud service account with the Sheets and Drive APIs enabled. Share the responses sheet (and later the photos folder) with its email as **Viewer**.
2. `npx wrangler@4 kv namespace create DATA` and paste the id into `wrangler.jsonc`.
3. `npx wrangler@4 secret put GOOGLE_SERVICE_ACCOUNT` (the key JSON), `npx wrangler@4 secret put SHEET_ID` (from the sheet's URL) and `npx wrangler@4 secret put PHOTOS_FOLDER_ID` (from the website-photos folder's URL; share the folder with the service account too). Photos are named by the instructor's form email (`ana@example.com.jpg`); shoot photos go in a `Professional` subfolder and win.
4. `scripts/upload-fonts.sh <studio-app>/brand/fonts/Type` (the brand fonts live in KV, not this repo: Trio Grotesk is licensed).
5. `npm run deploy`.

Never commit keys or instructor data: this repo is public.
