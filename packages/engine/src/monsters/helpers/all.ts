import Basilisk from '../basilisk.js';
import Gladiator from '../gladiator.js';
import Jinn from '../jinn.js';
import Minotaur from '../minotaur.js';
import Unicorn from '../unicorn.js';
import WeepingAngel from '../weeping-angel.js';

// Append new monsters: the spawn prompt answers with an index into this array, and
// existing tests and saved harness configs assume the first five positions.
const allMonsters = [Basilisk, Gladiator, Jinn, Minotaur, WeepingAngel, Unicorn];

export { allMonsters };
export default allMonsters;
