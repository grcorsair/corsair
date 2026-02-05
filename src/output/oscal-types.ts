/**
 * OSCAL Assessment Results Types
 *
 * Types conforming to NIST SP 800-53A OSCAL Assessment Results model.
 * Maps Corsair primitives to OSCAL structures:
 *   - ISC criteria  -> OSCAL findings (satisfied/not-satisfied)
 *   - MARK findings -> OSCAL observations
 *   - RAID results  -> OSCAL risks
 *   - ChartResult   -> OSCAL control-selections
 *
 * Reference: https://pages.nist.gov/OSCAL/concepts/layer/assessment/assessment-results/
 */

// ===============================================================================
// OSCAL COMMON TYPES
// ===============================================================================

/** OSCAL property - a name/value pair with optional class and namespace */
export interface OSCALProperty {
  name: string;
  value: string;
  class?: string;
  ns?: string;
}

/** OSCAL link - a reference to an external resource */
export interface OSCALLink {
  href: string;
  rel?: string;
  text?: string;
}

/** OSCAL party - an organization or individual */
export interface OSCALParty {
  uuid: string;
  type: "organization" | "person";
  name: string;
  remarks?: string;
}

/** OSCAL role - defines a function assumed by a party */
export interface OSCALRole {
  id: string;
  title: string;
  description?: string;
}

// ===============================================================================
// OSCAL METADATA
// ===============================================================================

/** OSCAL document metadata per the OSCAL metadata model */
export interface OSCALMetadata {
  title: string;
  "last-modified": string;
  version: string;
  "oscal-version": string;
  published?: string;
  remarks?: string;
  roles?: OSCALRole[];
  parties?: OSCALParty[];
  props?: OSCALProperty[];
  links?: OSCALLink[];
}

// ===============================================================================
// OSCAL OBSERVATION
// ===============================================================================

/** Observation method per OSCAL assessment results */
export type OSCALObservationMethod = "EXAMINE" | "INTERVIEW" | "TEST";

/** OSCAL subject reference - what was observed */
export interface OSCALSubjectReference {
  "subject-uuid": string;
  type: "component" | "inventory-item" | "location" | "party" | "user";
  title?: string;
  props?: OSCALProperty[];
}

/** OSCAL observation - maps to MARK drift findings */
export interface OSCALObservation {
  uuid: string;
  title: string;
  description: string;
  methods: OSCALObservationMethod[];
  collected: string;
  expires?: string;
  subjects?: OSCALSubjectReference[];
  props?: OSCALProperty[];
  links?: OSCALLink[];
  remarks?: string;
}

// ===============================================================================
// OSCAL RISK
// ===============================================================================

/** OSCAL risk status per the assessment results model */
export type OSCALRiskStatus =
  | "open"
  | "investigating"
  | "remediating"
  | "deviation-requested"
  | "deviation-approved"
  | "closed";

/** OSCAL characterization - describes risk origin */
export interface OSCALCharacterization {
  facets: OSCALFacet[];
}

/** OSCAL facet - a single dimension of risk characterization */
export interface OSCALFacet {
  name: string;
  system: string;
  value: string;
  props?: OSCALProperty[];
}

/** OSCAL risk - maps to RAID results */
export interface OSCALRisk {
  uuid: string;
  title: string;
  description: string;
  statement: string;
  status: OSCALRiskStatus;
  characterizations?: OSCALCharacterization[];
  props?: OSCALProperty[];
  links?: OSCALLink[];
}

// ===============================================================================
// OSCAL FINDING
// ===============================================================================

/** OSCAL finding target status - satisfied or not-satisfied */
export type OSCALFindingTargetStatus = "satisfied" | "not-satisfied";

/** OSCAL finding target - links a finding to a control */
export interface OSCALFindingTarget {
  type: "statement-id" | "objective-id";
  "target-id": string;
  status: OSCALFindingTargetStatus;
  props?: OSCALProperty[];
  remarks?: string;
}

/** OSCAL finding - maps to ISC criteria */
export interface OSCALFinding {
  uuid: string;
  title: string;
  description: string;
  target: OSCALFindingTarget;
  "observation-uuids"?: string[];
  "risk-uuids"?: string[];
  props?: OSCALProperty[];
  links?: OSCALLink[];
  remarks?: string;
}

// ===============================================================================
// OSCAL CONTROL SELECTION
// ===============================================================================

/** OSCAL control selection - identifies which controls were assessed */
export interface OSCALControlSelection {
  description?: string;
  "include-controls"?: { "control-id": string }[];
  "exclude-controls"?: { "control-id": string }[];
  props?: OSCALProperty[];
}

/** OSCAL reviewed controls - which controls were part of this assessment */
export interface OSCALReviewedControls {
  description?: string;
  "control-selections": OSCALControlSelection[];
  props?: OSCALProperty[];
}

// ===============================================================================
// OSCAL ATTESTATION
// ===============================================================================

/** OSCAL attestation - grouping of assessment results with responsible parties */
export interface OSCALAttestation {
  "responsible-parties"?: { "role-id": string; "party-uuids": string[] }[];
  parts?: { name: string; prose?: string }[];
}

// ===============================================================================
// OSCAL RESULT (Assessment Result Container)
// ===============================================================================

/** OSCAL result - contains all findings, observations, and risks for one assessment */
export interface OSCALResult {
  uuid: string;
  title: string;
  description: string;
  start: string;
  end?: string;
  "reviewed-controls": OSCALReviewedControls;
  findings?: OSCALFinding[];
  observations?: OSCALObservation[];
  risks?: OSCALRisk[];
  attestations?: OSCALAttestation[];
  props?: OSCALProperty[];
  remarks?: string;
}

// ===============================================================================
// OSCAL ASSESSMENT RESULT (Top-Level Document)
// ===============================================================================

/** OSCAL import-ap - reference to the assessment plan */
export interface OSCALImportAP {
  href: string;
  remarks?: string;
}

/** Top-level OSCAL Assessment Results document */
export interface OSCALAssessmentResult {
  "assessment-results": {
    uuid: string;
    metadata: OSCALMetadata;
    "import-ap"?: OSCALImportAP;
    results: OSCALResult[];
  };
}
