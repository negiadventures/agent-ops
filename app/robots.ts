import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Everything here is meant to be found. There is no admin, no API and nothing
 * behind a login, so there is nothing to keep out.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
