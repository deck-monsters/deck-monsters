const isProbable = ({ probability }) => (Math.random() * 100) <= probability;

module.exports = isProbable;
