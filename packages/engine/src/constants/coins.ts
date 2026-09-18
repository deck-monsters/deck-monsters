export const COINS_PER_VICTORY = 5;
export const COINS_PER_DEFEAT = 2;

/**
 * A small participation grant attached to the first completed fight of each UTC day.
 *
 * Five coins is deliberately useful without replacing play: it is half the face value
 * of the cheapest paid goods, while normal shop markup makes those goods cost 12–18.
 */
export const COINS_PER_DAILY_FIGHT = 5;

export const getUtcDay = (now: Date = new Date()): string => now.toISOString().slice(0, 10);
