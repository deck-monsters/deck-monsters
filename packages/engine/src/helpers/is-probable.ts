import { percent } from './chance.js';

interface Probable {
	probability: number;
}

const isProbable = ({ probability }: Probable): boolean => percent() <= probability;

export default isProbable;
export { isProbable };
