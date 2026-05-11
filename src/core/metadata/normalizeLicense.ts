/**
 * License Normalization
 * Maps VRM 0.x and VRM 1.0 license metadata to a single NormalizedLicense shape.
 * This is the fix point for VRM 1.0 license fields being silently dropped.
 */

import { VRM } from '@pixiv/three-vrm';
import { NormalizedLicense } from '../../types/database.types';

// --- VRM 0.x raw meta shape (typos are in the spec) ---
interface VRM0Meta {
  allowedUserName?: string;
  violentUssageName?: string;   // spec typo
  sexualUssageName?: string;    // spec typo
  commercialUssageName?: string;// spec typo
  licenseName?: string;
  licenseUrl?: string;
  otherLicenseUrl?: string;
  creditNotation?: string;
  allowRedistribution?: string;
  modification?: string;
  politicalOrReligiousUsageName?: string;
  antisocialOrHateUsageName?: string;
}

// --- VRM 1.0 raw meta shape ---
interface VRM1Meta {
  licenseUrl?: string;
  commercialUsage?: string;
  modification?: string;
  creditNotation?: string;
  allowExcessivelyViolentUsage?: boolean;
  allowExcessivelySexualUsage?: boolean;
  allowPoliticalOrReligiousUsage?: boolean;
  allowAntisocialOrHateUsage?: boolean;
  allowRedistribution?: boolean;
  allowedUserName?: string;
}

function normalizeAllowDisallow(
  value: string | boolean | undefined
): 'Disallow' | 'Allow' | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value ? 'Allow' : 'Disallow';
  const v = String(value).toLowerCase();
  if (v === 'allow' || v === 'true') return 'Allow';
  if (v === 'disallow' || v === 'false') return 'Disallow';
  return undefined;
}

function normalizeAllowedUser(
  value: string | undefined
): NormalizedLicense['allowedUserName'] {
  if (!value) return undefined;
  switch (value) {
    case 'OnlyAuthor': return 'OnlyAuthor';
    case 'ExplicitlyLicensedPerson': return 'ExplicitlyLicensedPerson';
    case 'Everyone': return 'Everyone';
    default: return undefined;
  }
}

function normalizeCommercial(
  value: string | undefined
): NormalizedLicense['commercialUsage'] {
  if (!value) return undefined;
  switch (value) {
    case 'Disallow': return 'Disallow';
    case 'Allow': return 'Allow';
    case 'PersonalNonProfit': return 'PersonalNonProfit';
    case 'PersonalProfit': return 'PersonalProfit';
    case 'Corporation': return 'Corporation';
    // VRM 0.x uses "Allow"/"Disallow" via commercialUssageName
    default: return value as NormalizedLicense['commercialUsage'];
  }
}

function normalizeModification(
  value: string | undefined
): NormalizedLicense['modification'] {
  if (!value) return undefined;
  switch (value) {
    case 'Prohibited': return 'Prohibited';
    case 'AllowModification': return 'AllowModification';
    case 'AllowModificationRedistribution': return 'AllowModificationRedistribution';
    default: return undefined;
  }
}

function normalizeCreditNotation(
  value: string | undefined
): NormalizedLicense['creditNotation'] {
  if (!value) return undefined;
  return value === 'Required' || value === 'Unnecessary'
    ? (value as 'Required' | 'Unnecessary')
    : undefined;
}

/**
 * Detect VRM version by probing known 1.0-only field names on meta.
 * VRM 1.0 meta has `commercialUsage` (no typo); 0.x has `commercialUssageName`.
 */
function isVRM1Meta(meta: Record<string, unknown>): boolean {
  return (
    'commercialUsage' in meta ||
    'allowExcessivelyViolentUsage' in meta ||
    'allowExcessivelySexualUsage' in meta
  );
}

export function normalizeLicense(vrm: VRM | undefined, _format: string): NormalizedLicense {
  if (!vrm || !vrm.meta) return {};

  const meta = vrm.meta as unknown as Record<string, unknown>;

  if (isVRM1Meta(meta)) {
    // VRM 1.0 path
    const m = meta as unknown as VRM1Meta;
    const result: NormalizedLicense = {};

    if (m.licenseUrl) result.licenseUrl = m.licenseUrl;
    if (m.commercialUsage) result.commercialUsage = normalizeCommercial(m.commercialUsage);
    if (m.modification) result.modification = normalizeModification(m.modification);
    if (m.creditNotation) result.creditNotation = normalizeCreditNotation(m.creditNotation);
    if (m.allowedUserName) result.allowedUserName = normalizeAllowedUser(m.allowedUserName);

    const violent = normalizeAllowDisallow(m.allowExcessivelyViolentUsage);
    if (violent !== undefined) result.violentUsage = violent;

    const sexual = normalizeAllowDisallow(m.allowExcessivelySexualUsage);
    if (sexual !== undefined) result.sexualUsage = sexual;

    const political = normalizeAllowDisallow(m.allowPoliticalOrReligiousUsage);
    if (political !== undefined) result.politicalOrReligiousUsage = political;

    const antisocial = normalizeAllowDisallow(m.allowAntisocialOrHateUsage);
    if (antisocial !== undefined) result.antisocialOrHateUsage = antisocial;

    const redistribution = normalizeAllowDisallow(m.allowRedistribution);
    if (redistribution !== undefined) result.allowRedistribution = redistribution;

    return result;
  }

  // VRM 0.x path
  const m = meta as unknown as VRM0Meta;
  const result: NormalizedLicense = {};

  if (m.licenseName) result.licenseName = m.licenseName;
  if (m.licenseUrl) result.licenseUrl = m.licenseUrl;
  if (m.otherLicenseUrl) result.otherLicenseUrl = m.otherLicenseUrl;
  if (m.allowedUserName) result.allowedUserName = normalizeAllowedUser(m.allowedUserName);
  if (m.creditNotation) result.creditNotation = normalizeCreditNotation(m.creditNotation);
  if (m.modification) result.modification = normalizeModification(m.modification);

  // 0.x uses "Allow"/"Disallow" strings via *UssageName fields
  if (m.violentUssageName) {
    result.violentUsage = normalizeAllowDisallow(m.violentUssageName);
  }
  if (m.sexualUssageName) {
    result.sexualUsage = normalizeAllowDisallow(m.sexualUssageName);
  }
  if (m.commercialUssageName) {
    result.commercialUsage = normalizeCommercial(m.commercialUssageName);
  }
  if (m.politicalOrReligiousUsageName) {
    result.politicalOrReligiousUsage = normalizeAllowDisallow(m.politicalOrReligiousUsageName);
  }
  if (m.antisocialOrHateUsageName) {
    result.antisocialOrHateUsage = normalizeAllowDisallow(m.antisocialOrHateUsageName);
  }
  if (m.allowRedistribution) {
    result.allowRedistribution = normalizeAllowDisallow(m.allowRedistribution);
  }

  return result;
}
