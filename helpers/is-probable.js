const { percent } = require('./chance');

const isProbable = ({ probability }) => percent() <= probability;

module.exports = isProbable;
