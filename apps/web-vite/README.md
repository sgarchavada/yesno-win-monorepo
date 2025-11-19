# yesno.win - Vite + React Migration

## ✅ Migration Complete!

Successfully migrated from Next.js to Vite + React.

### What Changed
- **Framework**: Next.js → Vite + React
- **Routing**: Next.js App Router → React Router v7
- **Build Tool**: Next.js/Turbopack → Vite
- **Environment Variables**: `NEXT_PUBLIC_*` → `VITE_*`

### Key Benefits
- ⚡ **Instant HMR** - Changes reflect immediately
- 🚀 **Fast builds** - 6-10x faster than Next.js
- 🎯 **No SSR/SSG issues** - Pure client-side rendering
- 📦 **Smaller bundle** - No Next.js overhead
- 🔧 **Simple deployment** - Just static files

## Development

```bash
npm run dev      # Start dev server on http://localhost:3000
npm run build    # Build for production
npm run preview  # Preview production build
```

## Deployment

### Vercel
1. Set Root Directory to: `apps/web-vite`
2. Build Command: `npm run build`
3. Output Directory: `dist`
4. Install Command: `npm install`
5. Add environment variables (with `VITE_` prefix)

### Any Static Host (Netlify, Cloudflare Pages, etc.)
Just upload the `dist` folder after running `npm run build`

## Environment Variables

All variables use the `VITE_` prefix (see `.env` file):
- `VITE_THIRDWEB_CLIENT_ID`
- `VITE_CHAIN_ID`
- `VITE_USDC_ADDRESS`
- `VITE_MARKET_FACTORY_PROXY`
- etc.

## Routes
- `/` - Home (market list)
- `/market/:id` - Market detail
- `/portfolio` - User portfolio
- `/create` - Create market
- `/become-creator` - Creator registration
- `/yesno-admin` - Admin panel

## Notes
- All Next.js specific code has been removed
- `Link` components now use `to` instead of `href`
- No more "use client" directives needed
- Environment variables are accessed via `import.meta.env.VITE_*`
