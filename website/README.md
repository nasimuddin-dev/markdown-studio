# Markpion website

The public documentation and product website, built with [VitePress](https://vitepress.dev) and deployed to GitHub Pages at **https://nasimuddin-dev.github.io/markpion/**. This file is for maintainers; it isn't published.

## Why VitePress

- It's static: plain HTML, CSS and a little JavaScript, hosted free on GitHub Pages with no server.
- Pages are Markdown, the product's own subject, and the site is built with Vite and Vue, which the project already knows.
- It includes navigation, a sidebar, local search, dark mode, a sitemap and syntax highlighting, with few dependencies.
- The website has its own `package.json`, so its dependencies never touch the desktop app.

## Commands

From the repository root (after `npm run docs:install` once):

| Command | What it does |
| --- | --- |
| `npm run docs:install` | Installs the website's dependencies (`website/node_modules`) |
| `npm run docs:dev` | Development server with hot reload at http://localhost:5173/markpion/ |
| `npm run docs:build` | Builds the static site into `website/.vitepress/dist/` |
| `npm run docs:preview` | Serves the build at http://localhost:4173/markpion/ |
| `npm run docs:check` | Type check, content check, build (fails on dead links), link check of the output |
| `npm run docs:test` | Browser checks of the build: WCAG 2.1 AA audits in light and dark, mobile layout |
| `npm run docs:screenshots` | Recaptures the app screenshots in `docs/site/images/` (needs the root dependencies) |

Inside `website/`, the same commands are `npm run dev`, `build`, `preview`, `check` and `typecheck`. `node scripts/check-links.mjs --external` also checks the GitHub and release download links (needs network).

## Layout

The pages live with the rest of the documentation in `docs/site/`; this folder holds the tooling.

```text
docs/site/                   the pages (srcDir); URLs follow the file paths
├── data/
│   ├── release.data.ts      version, release date and installer links, from the app's package.json and git tags
│   └── shortcuts.data.ts    keyboard shortcuts parsed from src/features/commands.ts
├── images/                  app screenshots (bundled with hashed names)
└── public/                  copied as-is: logo, robots.txt, the social preview image
website/
├── .vitepress/
│   ├── config.ts            site config: navigation, sidebar, SEO (canonical, Open Graph, JSON-LD), sitemap
│   └── theme/               default theme + <Downloads> and <Shortcuts> components, custom CSS
└── scripts/                 content check, link check, screenshot capture, browser checks
```

Because the pages are outside `website/`, `config.ts` resolves their package imports (Vue) from `website/node_modules`, never from the desktop app's dependencies at the repository root, and the shortcut loader uses the website's TypeScript.

## Single sources of truth

- **Version and downloads.** Nothing on the site hard-codes the version. `release.data.ts` reads it from the root `package.json`, and the installer names follow the convention of `scripts/release-installer.mjs` and `.github/workflows/release.yml`. The release commit's version bump redeploys the site.
- **Keyboard shortcuts** are parsed from the app's command definitions at build time. If the structure of `src/features/commands.ts` changes so that fewer than 30 shortcuts are found, the build fails instead of publishing an incomplete table.
- **Changelog.** `docs/site/changelog.md` is updated with each release, from the release's commits (see the dev log). Never add a release that isn't published.

## Writing pages

- Every page needs front matter with a unique `title` and a `description` of 50–200 characters (`npm run docs:check` enforces this, and one H1 per page and alt text on every image).
- Document only what the app actually does; check the source when unsure. Don't publish ratings, user counts, prices or performance claims.
- Vue interpolates `{{ … }}`, so wrap template placeholders in code or a `::: v-pre` block.
- Link between pages with root-relative paths without `.md`, for example `/guide/editor#layout`. The base path `/markpion/` is added automatically.
- Screenshots come from the real UI (`npm run docs:screenshots` drives the browser build of the app). Don't add mock-ups.

## Deployment

`.github/workflows/documentation.yml` runs on pushes to `main` that change the website or its pages (`docs/site/`), the app version or the shortcut definitions (so each release's version bump redeploys it), and by hand. It doesn't run on release events: the `github-pages` environment only accepts deployments from `main`. It installs the website's dependencies, runs `npm run check`, uploads the build, and deploys it with GitHub Pages. Pull requests are built and checked, not deployed.

**One-time setup** (repository owner): in GitHub, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**. Then run the workflow (**Actions → Documentation website → Run workflow**) or push a change.

## Google Search Console

1. Open [Google Search Console](https://search.google.com/search-console) and choose **Add property**.
2. Choose **URL prefix** and enter `https://nasimuddin-dev.github.io/markpion/`. (A **Domain** property would need DNS access to `github.io`, which isn't possible.)
3. **Verify ownership** with the **HTML tag** method: Search Console shows a tag like `<meta name="google-site-verification" content="…">`. Add it to `head` in `.vitepress/config.ts`, for example `["meta", { name: "google-site-verification", content: "…" }]`, push, wait for the deployment, and click **Verify**. The verification code is public by design and isn't a secret, but never commit passwords, tokens or keys.
4. **Submit the sitemap:** in **Sitemaps**, enter `sitemap.xml` (the full URL is `https://nasimuddin-dev.github.io/markpion/sitemap.xml`) and submit. `robots.txt` also points crawlers to it.
5. **Monitor indexing** under **Indexing → Pages**: it lists indexed pages and why others aren't indexed. Use **URL inspection** to check a page or request indexing after a big change.
6. **Review search queries** under **Performance**: the queries people use to find the site, with impressions, clicks and positions. Use them to improve page titles and descriptions.
7. **Review issues** under **Experience** (Core Web Vitals, HTTPS) and **Enhancements** (structured data such as breadcrumbs and articles). Fix reported problems in the pages or `config.ts`, and use **Validate fix** afterwards.

If the site later moves to a custom domain, update `SITE` and `BASE` in `.vitepress/config.ts` and `robots.txt`, add the domain in **Settings → Pages**, and add a new Search Console property.

## Future pages

The navigation leaves room for pages such as `/pricing`, `/pro`, `/ai`, `/cloud`, `/teams` or `/enterprise`: add a Markdown file in `docs/site/`, a nav or sidebar entry in `config.ts`, and it's included in the sitemap automatically. Don't publish them until the offering exists.
