/**
 * SSF Configuration Endpoint
 * GET /.well-known/ssf-configuration
 *
 * Returns SSF transmitter metadata per OpenID SSF specification.
 * https://openid.net/specs/openid-sharedsignals-framework-1_0.html
 */

import { FLAGSHIP_EVENTS } from "../src/flagship/flagship-types";

/**
 * Create an SSF configuration handler for the given domain.
 */
export function createSSFConfigHandler(domain: string): (req: Request) => Response {
  return (_req: Request): Response => {
    return Response.json(
      {
        issuer: `https://${domain}`,
        jwks_uri: `https://${domain}/.well-known/jwks.json`,
        delivery_methods_supported: [
          "urn:ietf:rfc:8935", // Push delivery
          "urn:ietf:rfc:8936", // Poll delivery
        ],
        configuration_endpoint: `https://api.${domain}/ssf/streams`,
        status_endpoint: `https://api.${domain}/ssf/streams/{stream_id}/status`,
        supported_events: [
          FLAGSHIP_EVENTS.COLORS_CHANGED,
          FLAGSHIP_EVENTS.FLEET_ALERT,
          FLAGSHIP_EVENTS.PAPERS_CHANGED,
          FLAGSHIP_EVENTS.MARQUE_REVOKED,
        ],
      },
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };
}

/**
 * Legacy handler with hardcoded grcorsair.com domain.
 * @deprecated Use createSSFConfigHandler(domain) instead.
 */
export function handleSSFConfiguration(_req: Request): Response {
  return createSSFConfigHandler("grcorsair.com")(_req);
}
