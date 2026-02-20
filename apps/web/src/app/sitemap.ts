import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://grcorsair.com";
  const now = new Date();

  return [
    // Core pages
    { url: baseUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/how-it-works`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${baseUrl}/for-grc`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${baseUrl}/docs`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/verify`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${baseUrl}/publish`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/sign`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/log`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/diff`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/signal`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },

    // Blog posts
    { url: `${baseUrl}/blog/introducing-marque`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/blog/cpoe-pieces-of-eight`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/blog/parley-v2-standards`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },

    // Docs — Getting Started
    { url: `${baseUrl}/docs/getting-started/quick-start`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/docs/getting-started/core-concepts`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },

    // Docs — Concepts
    { url: `${baseUrl}/docs/concepts/pipeline`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/docs/concepts/marque-signing`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/docs/concepts/evidence-chain`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/docs/concepts/flagship-events`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/docs/concepts/parley-protocol`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/docs/concepts/policy`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/docs/concepts/trust-graph`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },

    // Docs — Integrations
    { url: `${baseUrl}/docs/integrations/api`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/docs/integrations/sdk`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/docs/integrations/ci-cd`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/docs/integrations/jwt-vc`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/docs/integrations/oscal-output`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/docs/integrations/skills`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },

    // Redirect pages
    { url: `${baseUrl}/marque`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];
}
