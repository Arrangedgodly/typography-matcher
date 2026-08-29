# Deploy — GitHub Pages

**This is the halt gate.** Everything up to publishing is done and committed:
the repo is clean, `main` holds the full history, the deploy workflow
(`.github/workflows/deploy.yml`) is in place, and the production build has
been verified to serve from the `/typography-matcher/` subpath locally.

**Nothing has been pushed and no GitHub repo has been created.** Publishing
is a deliberate act you take by hand below. Once you push, every future push
to `main` auto-deploys.

## What was verified locally (T18, 2026-08-28)

- `npm run build` → exit 0; `dist/index.html` asset URLs are
  `/typography-matcher/assets/…` (from `vite.config.ts` `base`).
- `vite preview` → index 200, JS 200, CSS 200 at
  `http://localhost:<port>/typography-matcher/`.
- A plain static server (`python3 -m http.server`) with the app nested under
  a `typography-matcher/` directory — the same shape as a GitHub Pages
  project site — serves index and both hashed assets at 200, with a 404
  sanity check confirming the subpath is what resolves.

## What the workflow does on push to `main`

`npm ci` → `npm run validate:fonts` (Node 24 — the validator type-strips
`.ts` imports, needing Node ≥ 23.6) → `npm test` → `npm run build` → upload
`dist/` → deploy via `actions/deploy-pages`. E2E is deliberately not in CI
(it drives the machine's system Chrome over the real Google Fonts network);
run `npm run test:e2e` locally before publishing if you want the full gate.

## Publish sequence A — GitHub web UI

1. Create the repo at <https://github.com/new>:
   - Owner: yours. Name: **`typography-matcher`** (the name is load-bearing —
     the Pages URL and the Vite base both derive from it).
   - Public or private (Pages on private repos requires a paid plan).
   - Do **not** add README / .gitignore / license — the local repo has all
     content and a stray initial commit would need reconciling.
2. Wire the remote and push (first push = the halt-gate act):
   ```sh
   git remote add origin git@github.com:YOUR_USERNAME/typography-matcher.git
   # or: git remote add origin https://github.com/YOUR_USERNAME/typography-matcher.git
   git push -u origin main
   ```
3. Enable Pages with the Actions source: repo **Settings → Pages →
   Build and deployment → Source: GitHub Actions**.
4. The push in step 2 already triggered the workflow. If its deploy step ran
   before step 3 finished (first-run race, the deploy fails until the source
   is set), re-run it: **Actions → "Deploy to GitHub Pages" → latest run →
   Re-run all jobs**. (Alternatively do step 3 before step 2 and there is no
   race.)
5. Verify: open `https://YOUR_USERNAME.github.io/typography-matcher/` —
   the examination-room first viewport should land; DevTools network shows
   `/typography-matcher/assets/*.js|css` at 200.

## Publish sequence B — gh CLI (equivalent)

```sh
gh auth status          # be logged in first (gh auth login)
# The next command creates the repo AND pushes — this is the halt-gate act:
gh repo create typography-matcher --public --source . --remote origin --push

# Point Pages at the Actions source (same as the Settings toggle in A3):
gh api repos/:owner/typography-matcher/pages -X POST -f build_type=workflow

# If the first run predates the line above, re-run it:
gh run watch            # or: gh workflow run deploy.yml
```

## After publishing

- Every push to `main` re-runs validation + tests + build and auto-deploys.
- Renaming the repo changes the Pages URL — update `base` in
  `vite.config.ts` to match (or serve a user-site at `/` with `base: '/'`).
- A custom domain is out of scope here; it would also change the effective
  base path.
