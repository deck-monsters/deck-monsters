const startCase = (value: unknown = ''): string =>
	String(value)
		.replace(/['"]/g, '')
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/[_-]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.split(' ')
		.filter(Boolean)
		.map(word => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
		.join(' ');

export default startCase;
export { startCase };
