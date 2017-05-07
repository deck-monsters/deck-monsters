const wrap = require('word-wrap');

const formatCard = ({ title, description, stats }) => (
`
\`\`\`
===========================================
${wrap(title, { indent: '| ', width: 40 })}
-------------------------------------------
|
${wrap(description, { indent: '| ', width: 40 })}
|
${wrap(stats, { indent: '| ', width: 40 })}
|
===========================================
\`\`\`
`
);

module.exports = { formatCard };
