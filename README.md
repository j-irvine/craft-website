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

## Deploy

Merging to `main` deploys the Worker (`.github/workflows/deploy.yml`) to https://craft-website.craftpilates.workers.dev. The live site only changes where Showit embeds it. The workflow reads its settings from the repository's Actions secrets, listed at the top of that file. KV and the fonts are set up by the workflow; KK Topo (OFL) is in `fonts/`, while Trio Grotesk is licensed and comes from a secret (a Latin subset, base64).

Never commit keys or instructor data: this repo is public.
