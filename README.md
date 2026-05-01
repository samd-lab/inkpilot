# TattooDesignr

AI tattoo design generator. Get 8 custom designs in 30 seconds. $9. No signup. No saved data.

Live: https://tattoodesignr.com

## Stack

- Static HTML + Tailwind (CDN) for v1 landing page
- Hosted on Netlify with auto-deploy from GitHub
- Future: Next.js app for `/generate` with Stripe Checkout + Replicate API

## Local preview

Open `index.html` in any browser. No build step.

## Deploy (one-time setup)

### 1. Push to GitHub

```bash
cd inkpilot-site
git init
git add .
git commit -m "Initial commit: TattooDesignr landing page"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/inkpilot.git
git push -u origin main
```

### 2. Connect Netlify

1. Sign in at https://app.netlify.com (use GitHub login)
2. "Add new site" → "Import from Git" → pick the `inkpilot` repo
3. Build settings: leave defaults (Netlify auto-detects from `netlify.toml`)
4. Click "Deploy site"
5. Site is live at `your-random-name.netlify.app` within 30 seconds

### 3. Connect custom domain

1. Buy `tattoodesignr.com` at Cloudflare Registrar (cheapest, at-cost ~$10/yr) or Porkbun (~$11/yr)
2. In Netlify: Site settings → Domain management → Add custom domain → `tattoodesignr.com`
3. Netlify shows DNS records to add at your registrar
4. Add the records — within 1-24 hours, `https://tattoodesignr.com` is live with auto-SSL

## Future work

- `/generate` page with prompt input + style picker
- Stripe Checkout integration
- Serverless function calling Replicate for image generation
- Per-style fine-tuned LoRAs (traditional, Japanese, minimalist, etc.)

## Privacy posture

- No user accounts
- No database stores user content
- Photos and prompts processed in memory only, deleted post-delivery
- Stripe handles all payment data on their side
