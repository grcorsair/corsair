/**
 * Webhook Dispatch Hooks -- Integration Point for CPOE Lifecycle Events
 *
 * Wires webhook dispatch into the sign pipeline and certification engine.
 * Provides a singleton WebhookManager and typed helper functions for
 * dispatching CPOE lifecycle events (signed, scored, drifted, expired).
 *
 * Usage:
 *   import { onCPOESigned } from "./dispatch-hooks";
 *   await onCPOESigned(cpoeId, issuer, scope);
 *
 * Endpoints must be registered on the singleton manager before events
 * are dispatched. If no endpoints are registered, dispatch is a no-op.
 */

import { WebhookManager } from "./webhook-manager";
import type { WebhookEventType } from "./types";

// =============================================================================
// SINGLETON
// =============================================================================

/** Global webhook manager instance */
let _manager: WebhookManager | undefined;

/** Returns the singleton WebhookManager instance, creating it on first call */
export function getWebhookManager(): WebhookManager {
  if (!_manager) _manager = new WebhookManager();
  return _manager;
}

// =============================================================================
// GENERIC DISPATCH
// =============================================================================

/** Dispatch a CPOE lifecycle event. No-op if no endpoints are registered. */
export async function dispatchCPOEEvent(
  event: WebhookEventType,
  data: Record<string, unknown>,
): Promise<void> {
  const manager = getWebhookManager();
  const endpoints = manager.listEndpoints();
  if (endpoints.length > 0) {
    await manager.dispatch(event, data);
  }
}

// =============================================================================
// TYPED HELPERS
// =============================================================================

/** Dispatch cpoe.signed event */
export function onCPOESigned(
  cpoeId: string,
  issuer: string,
  scope: string,
): Promise<void> {
  return dispatchCPOEEvent("cpoe.signed", {
    cpoeId,
    issuer,
    scope,
    signedAt: new Date().toISOString(),
  });
}

/** Dispatch score.changed event */
export function onScoreChanged(
  cpoeId: string,
  oldScore: number,
  newScore: number,
): Promise<void> {
  return dispatchCPOEEvent("score.changed", {
    cpoeId,
    oldScore,
    newScore,
    changedAt: new Date().toISOString(),
  });
}

/** Dispatch drift.detected event */
export function onDriftDetected(
  certId: string,
  scoreDelta: number,
  recommendation: string,
): Promise<void> {
  return dispatchCPOEEvent("drift.detected", {
    certId,
    scoreDelta,
    recommendation,
    detectedAt: new Date().toISOString(),
  });
}

/** Dispatch cpoe.expired event */
export function onCPOEExpired(
  cpoeId: string,
  expiredAt: string,
): Promise<void> {
  return dispatchCPOEEvent("cpoe.expired", {
    cpoeId,
    expiredAt,
  });
}
