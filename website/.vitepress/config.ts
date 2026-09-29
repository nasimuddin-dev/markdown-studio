import { defineConfig, type HeadConfig } from "vitepress";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The application version is read from the app's package.json, never typed here.
const app = JSON.parse(readFileSync(fileURLToPath(new URL("../../package.json", import.meta.url)), "utf8"));

export const REPO = "https://github.com/nasimuddin-dev/markpion";
const SITE = "https://nasimuddin-dev.github.io/markpion/";
const BASE = "/markpion/";
const PAGES = fileURLToPath(new URL("../../docs/site/", import.meta.url)).replace(/\\/g, "/");
const SOCIAL_IMAGE = `${SITE}images/social-preview.webp`;

/** Page URL (clean URLs) for a source file such as `guide/editor.md`. */
function pageUrl(relativePath: string) {
  const path = relativePath.replace(/(^|\/)index\.md$/, "$1").replace(/\.md$/, "");
  return SITE + path;
}

const titleCase = (s: string) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** schema.org data, limited to facts about the product (no ratings, prices or counts). */
function structuredData(relativePath: string, title: string, description: string, date?: string) {
  const url = pageUrl(relativePath);
  if (relativePath === "index.md") {
    return [
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "Markpion",
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Windows 10, Windows 11, macOS 10.15 or later, Linux",
        softwareVersion: app.version,
        description,
        url: SITE,
        downloadUrl: `${REPO}/releases/latest`,
        screenshot: SOCIAL_IMAGE,
      },
      { "@context": "https://schema.org", "@type": "WebSite", name: "Markpion", url: SITE },
      { "@context": "https://schema.org", "@type": "Organization", name: "Markpion", url: SITE, logo: `${SITE}logo.svg`, sameAs: [REPO] },
    ];
  }
  const parts = relativePath.replace(/(^|\/)index\.md$/, "").replace(/\.md$/, "").split("/").filter(Boolean);
  const crumbs = [{ name: "Home", item: SITE }];
  parts.forEach((p, i) => {
    const last = i === parts.length - 1;
    crumbs.push({ name: last ? title : titleCase(p), item: SITE + parts.slice(0, i + 1).join("/") + (last ? "" : "/") });
  });
  const data: object[] = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.item })),
    },
  ];
  if (relativePath.startsWith("blog/") && relativePath !== "blog/index.md") {
    data.push({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: title,
      description,
      url,
      image: SOCIAL_IMAGE,
      ...(date ? { datePublished: date } : {}),
      author: { "@type": "Organization", name: "Markpion" },
      publisher: { "@type": "Organization", name: "Markpion", logo: { "@type": "ImageObject", url: `${SITE}logo.svg` } },
    });
  }
  return data;
}

export default defineConfig({
  lang: "en-US",
  title: "Markpion",
  titleTemplate: ":title | Markpion",
  description: "Markpion is a local-first desktop Markdown editor for Windows, macOS and Linux with live preview, tabs, a file explorer, and import and export.",
  base: BASE,
  // The pages live with the rest of the project's documentation, in docs/site/.
  srcDir: "../docs/site",
  cleanUrls: true,
  lastUpdated: true,
  appearance: true,
  // Internal dead links fail the build (docs:check).
  ignoreDeadLinks: false,
  markdown: {
    // High-contrast light theme: every token meets WCAG AA (4.5:1) on the code background.
    theme: { light: "github-light-high-contrast", dark: "github-dark" },
  },
  vite: {
    resolve: {
      alias: [
        {
          // The appearance switch with an accessible name before hydration.
          find: /^.*\/VPSwitchAppearance\.vue$/,
          replacement: fileURLToPath(new URL("./theme/components/SwitchAppearance.vue", import.meta.url)),
        },
      ],
    },
    // Vue runs from website/node_modules in the server build (the pages are outside website/).
    ssr: { external: ["vue", "vue/server-renderer", "@vue/server-renderer"] },
    plugins: [
      {
        // The pages live in docs/site/, outside website/. Resolve their package
        // imports (vue, vitepress…) from the website's dependencies, never from
        // the desktop app's node_modules at the repository root.
        name: "markpion:pages-resolve-from-website",
        enforce: "pre",
        async resolveId(source, importer, options) {
          if (!importer || !/^[\w@]/.test(source) || /^[A-Za-z]:/.test(source)) return null;
          if (!importer.replace(/\\/g, "/").startsWith(PAGES)) return null;
          // The server build leaves Vue to Node, which finds it from website/.vitepress/.temp.
          if (options?.ssr && /^vue(\/|$)/.test(source)) return { id: source, external: true };
          return this.resolve(source, fileURLToPath(import.meta.url), { ...options, skipSelf: true });
        },
      },
    ],
  },
  sitemap: {
    hostname: SITE,
    transformItems: (items) => items.filter((i) => !/(^|\/)404$/.test(i.url)),
  },
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: `${BASE}logo.svg` }],
    ["meta", { name: "theme-color", content: "#2563eb" }],
    ["meta", { property: "og:site_name", content: "Markpion" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:image", content: SOCIAL_IMAGE }],
    ["meta", { property: "og:image:alt", content: "Markpion with a Markdown file in the editor and its live preview" }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "twitter:image", content: SOCIAL_IMAGE }],
  ],
  transformHead({ pageData, title, description }) {
    if (pageData.isNotFound) return [["meta", { name: "robots", content: "noindex" }]];
    const url = pageUrl(pageData.relativePath);
    const pageTitle = title;
    const date = pageData.frontmatter.date ? new Date(pageData.frontmatter.date).toISOString().slice(0, 10) : undefined;
    const head: HeadConfig[] = [
      ["link", { rel: "canonical", href: url }],
      ["meta", { property: "og:url", content: url }],
      ["meta", { property: "og:title", content: pageTitle }],
      ["meta", { property: "og:description", content: description }],
      ["meta", { name: "twitter:title", content: pageTitle }],
      ["meta", { name: "twitter:description", content: description }],
    ];
    for (const data of structuredData(pageData.relativePath, pageData.title, description, date)) {
      head.push(["script", { type: "application/ld+json" }, JSON.stringify(data)]);
    }
    if (date) head.push(["meta", { property: "article:published_time", content: date }]);
    return head;
  },
  themeConfig: {
    logo: { src: "/logo.svg", alt: "" },
    siteTitle: "Markpion",
    nav: [
      { text: "Download", link: "/download" },
      { text: "Features", link: "/features" },
      { text: "Documentation", link: "/getting-started/", activeMatch: "^/(getting-started|installation|guide|markdown|troubleshooting|reference)/" },
      { text: "FAQ", link: "/faq" },
      { text: "Changelog", link: "/changelog" },
      { text: "Roadmap", link: "/roadmap" },
      { text: "Blog", link: "/blog/" },
      { text: `v${app.version}`, items: [
        { text: "Release notes", link: "/changelog" },
        { text: "All releases on GitHub", link: `${REPO}/releases` },
      ] },
    ],
    sidebar: {
      "/blog/": [
        {
          text: "Blog",
          items: [
            { text: "All articles", link: "/blog/" },
            { text: "What Is Markdown?", link: "/blog/what-is-markdown" },
            { text: "Markdown Tables Guide", link: "/blog/markdown-tables-guide" },
            { text: "Mermaid Diagrams in Markdown", link: "/blog/mermaid-diagrams-in-markdown" },
            { text: "How to Write a Great README", link: "/blog/how-to-write-a-great-readme" },
          ],
        },
      ],
      "/": [
        {
          text: "Getting Started",
          items: [
            { text: "Introduction", link: "/getting-started/" },
            { text: "Installation", link: "/getting-started/installation" },
            { text: "First Document", link: "/getting-started/first-document" },
          ],
        },
        {
          text: "Installation",
          items: [
            { text: "Windows", link: "/installation/windows" },
            { text: "macOS", link: "/installation/macos" },
            { text: "Linux", link: "/installation/linux" },
          ],
        },
        {
          text: "User Guide",
          items: [
            { text: "Editor", link: "/guide/editor" },
            { text: "Writing Tools", link: "/guide/writing-tools" },
            { text: "File Explorer", link: "/guide/file-explorer" },
            { text: "Tabs", link: "/guide/tabs" },
            { text: "Preview", link: "/guide/preview" },
            { text: "Search & Replace", link: "/guide/search-replace" },
            { text: "Saving, History & Recovery", link: "/guide/saving-and-recovery" },
            { text: "Checking Documents", link: "/guide/checking-documents" },
            { text: "Import & Export", link: "/guide/import-export" },
            { text: "Settings", link: "/guide/settings" },
            { text: "Keyboard Shortcuts", link: "/reference/keyboard-shortcuts" },
          ],
        },
        {
          text: "Markdown",
          items: [
            { text: "Markdown Basics", link: "/markdown/" },
            { text: "GitHub Flavored Markdown", link: "/markdown/gfm" },
            { text: "Tables", link: "/markdown/tables" },
            { text: "Images", link: "/markdown/images" },
            { text: "Code Blocks", link: "/markdown/code-blocks" },
            { text: "Mermaid", link: "/markdown/mermaid" },
            { text: "Math / LaTeX", link: "/markdown/math" },
            { text: "Front Matter, Alerts & Footnotes", link: "/markdown/extras" },
          ],
        },
        {
          text: "Troubleshooting",
          items: [
            { text: "Overview", link: "/troubleshooting/" },
            { text: "App Doesn't Start", link: "/troubleshooting/app-does-not-start" },
            { text: "Opening & Saving Files", link: "/troubleshooting/opening-and-saving" },
            { text: "Preview, Mermaid & Math", link: "/troubleshooting/preview" },
            { text: "Import & Export", link: "/troubleshooting/import-export" },
            { text: "Updates", link: "/troubleshooting/updates" },
            { text: "Windows Installation", link: "/troubleshooting/windows" },
            { text: "macOS Installation", link: "/troubleshooting/macos" },
            { text: "Linux", link: "/troubleshooting/linux" },
          ],
        },
        {
          text: "Reference",
          items: [
            { text: "Keyboard Shortcuts", link: "/reference/keyboard-shortcuts" },
            { text: "Configuration", link: "/reference/configuration" },
            { text: "Privacy", link: "/privacy" },
            { text: "FAQ", link: "/faq" },
          ],
        },
      ],
    },
    socialLinks: [{ icon: "github", link: REPO, ariaLabel: "Markpion on GitHub" }],
    editLink: { pattern: `${REPO}/edit/main/docs/site/:path`, text: "Edit this page on GitHub" },
    search: { provider: "local" },
    outline: { level: [2, 3] },
    footer: {
      message: `Markpion ${app.version} · <a href="${REPO}">GitHub</a> · <a href="${REPO}/issues">Issues</a> · <a href="${REPO}/releases">Releases</a>`,
    },
  },
});
