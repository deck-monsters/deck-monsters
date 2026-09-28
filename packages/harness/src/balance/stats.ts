/**
 * Statistics for balance runs (roadmap 34, "Statistics and experimental design").
 *
 * Everything here is a plain function over counts or samples, so it can be unit-tested
 * against textbook values and reused by every planner and report. Scores are expected
 * scores in [0, 1] (win 1, draw 0.5, loss 0).
 */

/** Inverse of the standard normal CDF (Acklam's rational approximation, |error| < 1.2e-9). */
export function normalQuantile(p: number): number {
	if (!(p > 0 && p < 1)) throw new RangeError(`normalQuantile needs 0 < p < 1, got ${p}`);
	const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
	const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
	const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
	const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
	const low = 0.02425;
	if (p < low) {
		const q = Math.sqrt(-2 * Math.log(p));
		return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
	}
	if (p > 1 - low) return -normalQuantile(1 - p);
	const q = p - 0.5;
	const r = q * q;
	return (((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q / (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
}

/** Standard normal CDF (Abramowitz and Stegun 7.1.26 via erf, |error| < 1.5e-7). */
export function normalCdf(x: number): number {
	const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
	const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
	return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

export interface Interval {
	estimate: number;
	low: number;
	high: number;
	n: number;
}

/**
 * Wilson score interval for a proportion. `successes` may be fractional (draws count ½),
 * which is the usual approximation for an expected score.
 */
export function wilson(successes: number, n: number, confidence = 0.95): Interval {
	if (n <= 0) return { estimate: NaN, low: 0, high: 1, n: 0 };
	const z = normalQuantile(1 - (1 - confidence) / 2);
	const p = successes / n;
	const z2 = z * z;
	const centre = (p + z2 / (2 * n)) / (1 + z2 / n);
	const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
	return { estimate: p, low: Math.max(0, centre - half), high: Math.min(1, centre + half), n };
}

/** Mean and normal-approximation interval of a sample (e.g. paired differences). */
export function meanInterval(samples: readonly number[], confidence = 0.95): Interval {
	const n = samples.length;
	if (n === 0) return { estimate: NaN, low: NaN, high: NaN, n: 0 };
	const mean = samples.reduce((a, b) => a + b, 0) / n;
	if (n === 1) return { estimate: mean, low: -Infinity, high: Infinity, n };
	const variance = samples.reduce((acc, x) => acc + (x - mean) ** 2, 0) / (n - 1);
	const z = normalQuantile(1 - (1 - confidence) / 2);
	const half = z * Math.sqrt(variance / n);
	return { estimate: mean, low: mean - half, high: mean + half, n };
}

/** Fights needed for a proportion interval of ± `halfWidth` at `p` (worst case p = 0.5). */
export function fightsForHalfWidth(halfWidth: number, p = 0.5, confidence = 0.95): number {
	const z = normalQuantile(1 - (1 - confidence) / 2);
	return Math.ceil((z * z * p * (1 - p)) / (halfWidth * halfWidth));
}

/** Two-sided p-value of a mean against zero, from a normal approximation. */
export function pValueAgainstZero(samples: readonly number[]): number {
	const { estimate, low, high, n } = meanInterval(samples);
	if (n < 2) return 1;
	const se = (high - low) / (2 * normalQuantile(0.975));
	if (se === 0) return estimate === 0 ? 1 : 0;
	return 2 * (1 - normalCdf(Math.abs(estimate) / se));
}

/**
 * Holm-Bonferroni: which of `pValues` are rejected at family-wise level `alpha`. Returns a
 * boolean per input, in input order.
 */
export function holm(pValues: readonly number[], alpha = 0.05): boolean[] {
	const order = pValues.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
	const rejected = new Array<boolean>(pValues.length).fill(false);
	for (let k = 0; k < order.length; k += 1) {
		if (order[k]!.p > alpha / (order.length - k)) break;
		rejected[order[k]!.i] = true;
	}
	return rejected;
}

export type SprtDecision = 'above' | 'below' | 'continue';

/**
 * Wald's sequential probability ratio test on scores in [0, 1] (treated as Bernoulli, draws
 * as ½), for triage only: is the true score above `p1` or below `p0`? Roadmap 34 uses it to
 * decide where to spend fights; reported intervals come from fixed-size fresh samples.
 */
export function sprt(scoreSum: number, n: number, p0: number, p1: number, alpha = 0.05, beta = 0.05): SprtDecision {
	if (!(p0 > 0 && p1 < 1 && p0 < p1)) throw new RangeError('sprt needs 0 < p0 < p1 < 1');
	const llr = scoreSum * Math.log(p1 / p0) + (n - scoreSum) * Math.log((1 - p1) / (1 - p0));
	if (llr >= Math.log((1 - beta) / alpha)) return 'above';
	if (llr <= Math.log(beta / (1 - alpha))) return 'below';
	return 'continue';
}
