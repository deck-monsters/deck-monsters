/** "Pip's", but "Protector Of Creatures'": a name ending in s takes a bare apostrophe (Cursor's live check, roadmap 39). */
export const possessive = (name: string): string => (/s$/i.test(name) ? `${name}'` : `${name}'s`);
