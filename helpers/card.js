const wrap = require('word-wrap');

const formatCard = ({ title, description, stats }) => (
`
\`\`\`
===========================================
${wrap(title, { indent: '| ', width: 40 })}
-------------------------------------------${
!description ? '' :
`
|
${wrap(description, { indent: '| ', width: 40 })}`
}${
!stats ? '' :
`
|
${wrap(stats, { indent: '| ', width: 40 })}`
}
|
===========================================
\`\`\`
`
);

module.exports = { formatCard };
