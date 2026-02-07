/**
 * FLAGSHIP Module - SSF/SET/CAEP Event System
 *
 * The command ship that signals fleet-wide status changes.
 * Implements OpenID SSF, SET (RFC 8417), and CAEP for real-time
 * compliance change notifications in the Parley protocol.
 */

export {
  FLAGSHIP_EVENTS,
  type FlagshipEventType,
  type FlagshipSubject,
  type CAEPEventData,
  type ColorsChangedData,
  type FleetAlertData,
  type PapersChangedData,
  type MarqueRevokedData,
  type FlagshipEvent,
  type SETPayload,
  type SSFStreamConfig,
  type SSFStream,
  type FlagshipConfig,
} from "./flagship-types";

export { generateSET, verifySET } from "./set-generator";
export { MemorySSFStreamManager, SSFStreamManager, type SSFStreamManagerInterface } from "./ssf-stream";
export { PgSSFStreamManager, createStreamManager } from "./pg-ssf-stream";
export { FlagshipClient } from "./flagship-client";
