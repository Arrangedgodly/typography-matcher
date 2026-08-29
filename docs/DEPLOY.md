# Deploy — font.graydonwasil.com (GitHub Pages + Cloudflare DNS)

## Current state (2026-08-29)

- Repo: https://github.com/Arrangedgodly/typography-matcher (pushed, `main`, auto-deploys on push)
- GitHub Pages: enabled, source = GitHub Actions, custom domain `font.graydonwasil.com` attached (API, 204)
- Deploy workflow `.github/workflows/deploy.yml`: `npm ci` → `validate:fonts` → `npm test` → `npm run build` → upload `dist/` → `actions/deploy-pages`. E2E stays a local gate (drives system Chrome over the live Google Fonts network).
- Build shape: `vite.config.ts` `base: '/'` + `public/CNAME` (dist carries the hostname) — served from the domain root. Verified locally: build exit 0, 134 unit tests, 2 e2e journeys, preview serves at `/`.
- REMAINING: the Cloudflare DNS record (user step — no Cloudflare API access on the build machine), then Enforce HTTPS.

## User DNS step — Cloudflare dashboard → graydonwasil.com → DNS

1. Add record: **CNAME `font` → `arrangedgodly.github.io`**
2. Set it **DNS-only (grey cloud)** for now — GitHub must resolve the CNAME directly to issue its Let's Encrypt certificate. Cloudflare defaults new records to Proxied; toggle the cloud OFF.
3. Minutes-to-an-hour later, GitHub's cert shows Ready. Then, optionally:
   - **Enforce HTTPS**: repo Settings → Pages → tick *Enforce HTTPS* (or `PUT /repos/Arrangedgodly/typography-matcher/pages` with `{"https_enforced": true}` once the cert is Ready).
   - **Orange-cloud proxy, if wanted**: only AFTER the GitHub cert is issued, and set Cloudflare SSL/TLS → **Full (strict)**. *Flexible* mode causes redirect loops with GitHub Pages; *Full (strict)* works fine.

If the Pages settings page reports the domain as unverified, add the TXT record it displays
(`_github-pages-challenge-Arrangedgodly.font`) — personal-account repo domains usually skip
this, but GitHub asks on some accounts.

## Reference — what was executed (2026-08-29)

```bash
git remote add origin git@github.com:Arrangedgodly/typography-matcher.git
git push -u origin main
# Pages enable + custom domain (token with repo scope, from git credential store):
curl -X POST https://api.github.com/repos/Arrangedgodly/typography-matcher/pages \
  -H "Authorization: token <TOKEN>" -d '{"build_type":"workflow"}'
curl -X PUT https://api.github.com/repos/Arrangedgodly/typography-matcher/pages \
  -H "Authorization: token <TOKEN>" \
  -d '{"cname":"font.graydonwasil.com","build_type":"workflow","source":{"branch":"main","path":"/"}}'
```

Local verification (all green): `npm run build` exit 0 (dist root carries `CNAME`); `npm test`
134/134; `npm run test:e2e` 2/2 (root-path preview, scratch-port overlay); `vite preview` 200s
at `/`.
