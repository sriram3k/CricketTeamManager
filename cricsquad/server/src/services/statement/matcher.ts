import type { Cents } from '../../lib/money.js';

/**
 * Auto-matching a statement line to a player, in the priority order the spec
 * lays out. Pure functions — no DB access — so the tiers stay testable.
 *
 *   1. Exact amount match against a single player's total pending, or a single
 *      open charge
 *   2. Player name or mobile number in the transaction description (fuzzy,
 *      case-insensitive)
 *   3. PayNow reference containing a player identifier
 */

export interface MatchCandidate {
  playerId: string;
  name: string;
  mobile: string | null;
  pendingCents: Cents;
  openChargeAmounts: Cents[];
}

export interface MatchProposal {
  playerId: string | null;
  confidence: number;
  reason: string;
}

export const NO_MATCH: MatchProposal = {
  playerId: null,
  confidence: 0,
  reason: 'No matching player found',
};

/** Strip punctuation so "TAN WEI-MING" and "tan wei ming" compare equal. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Last 4+ digits of a Singapore mobile, as they appear in a PayNow narrative. */
function mobileFragments(mobile: string): string[] {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length < 4) return [];
  const local = digits.length > 8 ? digits.slice(-8) : digits;
  return [local, local.slice(-4)];
}

/**
 * Tier 1 — an amount that exactly equals exactly one player's total pending, or
 * exactly one player's single open charge. Ambiguity disqualifies the tier:
 * if two players owe the same amount, neither is proposed.
 */
export function matchByAmount(amountCents: Cents, candidates: MatchCandidate[]): MatchProposal | null {
  const byTotal = candidates.filter((c) => c.pendingCents === amountCents);
  if (byTotal.length === 1) {
    return {
      playerId: byTotal[0].playerId,
      confidence: 0.9,
      reason: `Amount matches ${byTotal[0].name}'s full outstanding balance`,
    };
  }
  if (byTotal.length > 1) return null; // ambiguous — fall through to the next tier

  const byCharge = candidates.filter((c) => c.openChargeAmounts.includes(amountCents));
  if (byCharge.length === 1) {
    return {
      playerId: byCharge[0].playerId,
      confidence: 0.75,
      reason: `Amount matches a single open charge for ${byCharge[0].name}`,
    };
  }

  return null;
}

/**
 * Tier 2 — the player's name or mobile appears in the description. Full-name
 * and all-token matches are treated as strong; a single distinctive token is
 * weaker and only accepted when exactly one player matches.
 */
export function matchByDescription(
  description: string,
  candidates: MatchCandidate[],
): MatchProposal | null {
  const haystack = normalise(description);
  const digits = description.replace(/\D/g, '');
  if (!haystack && !digits) return null;

  const hits: Array<{ candidate: MatchCandidate; confidence: number; reason: string }> = [];

  for (const candidate of candidates) {
    const name = normalise(candidate.name);
    if (!name) continue;

    if (candidate.mobile) {
      const fragment = mobileFragments(candidate.mobile).find(
        (f) => f.length >= 4 && digits.includes(f),
      );
      if (fragment) {
        hits.push({
          candidate,
          confidence: 0.88,
          reason: `Mobile number ending ${fragment.slice(-4)} appears in the description`,
        });
        continue;
      }
    }

    if (haystack.includes(name)) {
      hits.push({
        candidate,
        confidence: 0.85,
        reason: `Name "${candidate.name}" appears in the description`,
      });
      continue;
    }

    // Tokens ≥3 chars guard against "Lee" matching inside unrelated words and
    // against one-letter initials matching everything.
    const tokens = name.split(' ').filter((t) => t.length >= 3);
    if (tokens.length === 0) continue;

    const matched = tokens.filter((t) => new RegExp(`\\b${t}\\b`).test(haystack));
    if (matched.length === tokens.length) {
      hits.push({
        candidate,
        confidence: 0.8,
        reason: `All name parts of "${candidate.name}" appear in the description`,
      });
    } else if (matched.length > 0) {
      hits.push({
        candidate,
        confidence: 0.45 + 0.1 * matched.length,
        reason: `Partial name match on "${matched.join(', ')}" for ${candidate.name}`,
      });
    }
  }

  if (hits.length === 0) return null;

  hits.sort((a, b) => b.confidence - a.confidence);
  const best = hits[0];
  const runnerUp = hits[1];

  // A tie between two players is not a match — send it to manual review.
  if (runnerUp && runnerUp.confidence === best.confidence) return null;

  return { playerId: best.candidate.playerId, confidence: best.confidence, reason: best.reason };
}

/**
 * Tier 3 — a PayNow narrative carries a reference field that often holds a
 * player identifier: their UEN/NRIC-style tail, mobile, or an initials+number
 * code the club uses. Looks past the tiers above at the reference segment only.
 */
export function matchByPayNowReference(
  description: string,
  candidates: MatchCandidate[],
): MatchProposal | null {
  if (!/paynow|pay now|fast|ibg|inward|transfer/i.test(description)) return null;

  // The narrative usually reads "PAYNOW TRANSFER FROM: X REF: Y".
  const refSegment = description.match(/(?:ref|reference|otr|remarks?)[:\s]+(.{2,60})/i)?.[1] ?? '';
  const haystack = normalise(refSegment || description);
  const digits = (refSegment || description).replace(/\D/g, '');
  if (!haystack && !digits) return null;

  const hits: MatchCandidate[] = [];
  const reasons = new Map<string, string>();

  for (const candidate of candidates) {
    if (candidate.mobile) {
      const fragment = mobileFragments(candidate.mobile).find(
        (f) => f.length >= 4 && digits.includes(f),
      );
      if (fragment) {
        hits.push(candidate);
        reasons.set(candidate.playerId, `PayNow reference contains mobile ending ${fragment.slice(-4)}`);
        continue;
      }
    }

    // Initials code, e.g. "TWM" for Tan Wei Ming.
    const initials = normalise(candidate.name)
      .split(' ')
      .filter(Boolean)
      .map((t) => t[0])
      .join('');
    if (initials.length >= 2 && new RegExp(`\\b${initials}\\b`).test(haystack)) {
      hits.push(candidate);
      reasons.set(candidate.playerId, `PayNow reference contains initials "${initials.toUpperCase()}"`);
      continue;
    }

    const firstName = normalise(candidate.name).split(' ')[0];
    if (firstName.length >= 3 && new RegExp(`\\b${firstName}\\b`).test(haystack)) {
      hits.push(candidate);
      reasons.set(candidate.playerId, `PayNow reference contains "${firstName}"`);
    }
  }

  if (hits.length !== 1) return null;
  return {
    playerId: hits[0].playerId,
    confidence: 0.7,
    reason: reasons.get(hits[0].playerId) ?? 'PayNow reference match',
  };
}

/** Run the three tiers in priority order and return the first proposal. */
export function proposeMatch(
  line: { amountCents: Cents; description: string },
  candidates: MatchCandidate[],
): MatchProposal {
  return (
    matchByAmount(line.amountCents, candidates) ??
    matchByDescription(line.description, candidates) ??
    matchByPayNowReference(line.description, candidates) ??
    NO_MATCH
  );
}
