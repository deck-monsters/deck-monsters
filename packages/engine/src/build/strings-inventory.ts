/**
 * Generates the per-monster strings inventories under docs/reference/strings/.
 *
 * Why generated: the inventories were hand-copied from the source for editorial review,
 * and the first voice pass on the Unicorn left every one of its copied lines stale the
 * moment the source changed. They are now built from the engine in two ways:
 *
 *   - Runtime renders, for text whose final shape depends on data: each monster's long
 *     description, seeded `look at` examples across he/she/they, and each card's
 *     description and rules text.
 *   - Source extraction, for narration that only exists mid-fight: every string or
 *     template literal in the monster's file and in each of its signature cards (cards
 *     whose permitted types name the monster), with `${...}` rendered as readable
 *     `{placeholders}`. Lines elsewhere in the engine that name a card (Horn of Proof's
 *     refusal lives in immobilize.ts) are listed under that card too.
 *
 * Extraction is a reading aid, not a parser of meaning: a literal with no space in it is
 * treated as an identifier and skipped, and an expression the renderer does not know
 * falls back to its last property name in braces.
 */
import { readdirSync, readFileSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import ts from 'typescript';

import allMonsters from '../monsters/helpers/all.js';
import allCards from '../cards/helpers/all.js';
import { GENERATED_DOC_NOTICE, normalizeLineEndings } from './root-docs.js';

// dist/build and src/build both sit two levels below the package root.
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC_ROOT = join(PACKAGE_ROOT, 'src');
const REPO_ROOT = resolve(PACKAGE_ROOT, '../..');

export const STRINGS_INVENTORY_DIR = 'docs/reference/strings';

const LOOK_AT_EXAMPLES = 6;
const GENDERS = ['male', 'female', 'androgynous'];
// Properties whose values are rendered at runtime (or are the card's own name) instead of
// listed as templates.
const RUNTIME_RENDERED = new Set(['description', 'stats', 'cardType']);

interface Template {
	where: string;
	text: string;
}

interface SourceFile {
	path: string;
	source: ts.SourceFile;
}

const walkTs = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) return entry.name === 'build' ? [] : walkTs(full);
		return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.d.ts')
			? [full]
			: [];
	});

let sourceCache: SourceFile[] | undefined;
const allSources = (): SourceFile[] => {
	sourceCache ??= walkTs(SRC_ROOT).map(path => ({
		path,
		source: ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.ES2022, true),
	}));
	return sourceCache;
};

const repoPath = (path: string): string => relative(REPO_ROOT, path).split('\\').join('/');

const findClass = (className: string): { file: SourceFile; node: ts.ClassDeclaration } | undefined => {
	for (const file of allSources()) {
		let found: ts.ClassDeclaration | undefined;
		file.source.forEachChild(node => {
			if (ts.isClassDeclaration(node) && node.name?.text === className) found = node;
		});
		if (found) return { file, node: found };
	}
	return undefined;
};

/** Module-level `const NAME = <string | number literal>` values, for inlining. */
const moduleConstants = (source: ts.SourceFile): Map<string, string> => {
	const constants = new Map<string, string>();
	source.forEachChild(node => {
		if (!ts.isVariableStatement(node)) return;
		for (const decl of node.declarationList.declarations) {
			const init = decl.initializer;
			if (!ts.isIdentifier(decl.name) || !init) continue;
			if (ts.isStringLiteral(init) || ts.isNumericLiteral(init)) constants.set(decl.name.text, init.text);
		}
	});
	return constants;
};

interface RenderContext {
	constants: Map<string, string>;
	icon?: string;
	actions?: Record<string, string>;
}

const capitalizeFirst = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

const lastName = (expr: ts.Expression): string => {
	if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
	if (ts.isIdentifier(expr)) return expr.text;
	if (ts.isCallExpression(expr)) return lastName(expr.expression);
	return expr.getText();
};

/** Renders one `${expr}` as readable text: `target.givenName` → `{target}`, and so on. */
const renderExpression = (expr: ts.Expression, ctx: RenderContext): string => {
	if (ts.isParenthesizedExpression(expr) || ts.isNonNullExpression(expr)) {
		return renderExpression(expr.expression, ctx);
	}
	if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
		return renderExpression(expr.left, ctx);
	}
	if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr) || ts.isNumericLiteral(expr)) {
		return expr.text;
	}
	if (ts.isTemplateExpression(expr)) return renderLiteral(expr, ctx) ?? `{${expr.getText()}}`;
	// A ternary shows both branches, `{if true / if false}`, with an empty branch as `—`, so a
	// reviewer reads the words each branch can produce rather than the condition's source.
	if (ts.isConditionalExpression(expr)) {
		const branch = (node: ts.Expression): string => renderExpression(node, ctx) || '—';
		return `{${branch(expr.whenTrue)} / ${branch(expr.whenFalse)}}`;
	}
	if (ts.isIdentifier(expr) && ctx.constants.has(expr.text)) return ctx.constants.get(expr.text) as string;
	if (ts.isCallExpression(expr)) {
		const callee = lastName(expr.expression);
		if (callee === 'capitalize' && expr.arguments[0]) {
			const inner = renderExpression(expr.arguments[0], ctx);
			return inner.startsWith('{') ? `{${capitalizeFirst(inner.slice(1))}` : capitalizeFirst(inner);
		}
		if (callee === 'agree' && expr.arguments.length >= 3) {
			return `{${renderExpression(expr.arguments[1], ctx)}/${renderExpression(expr.arguments[2], ctx)}}`;
		}
		return `{${callee}}`;
	}
	if (ts.isPropertyAccessExpression(expr)) {
		const text = expr.getText();
		if (text === 'this.icon' && ctx.icon) return ctx.icon;
		const action = /^this\.actions\.(\w+)$/.exec(text);
		if (action && ctx.actions?.[action[1]]) return ctx.actions[action[1]];
		if (expr.name.text === 'givenName') return `{${lastName(expr.expression)}}`;
		const pronoun = /\.pronouns\.(\w+)$/.exec(text);
		if (pronoun) return `{${pronoun[1]}}`;
		return `{${expr.name.text}}`;
	}
	return `{${expr.getText()}}`;
};

const renderLiteral = (node: ts.Node, ctx: RenderContext): string | undefined => {
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
	if (ts.isTemplateExpression(node)) {
		return (
			node.head.text +
			node.templateSpans.map(span => renderExpression(span.expression, ctx) + span.literal.text).join('')
		);
	}
	return undefined;
};

/** Where a literal sits: its method, then the property or variable it is assigned to. */
const locate = (node: ts.Node): { where: string; skip: boolean } => {
	let key: string | undefined;
	let member: string | undefined;
	let skip = false;
	for (let current = node.parent; current; current = current.parent) {
		if (!key && ts.isPropertyAssignment(current)) key = current.name.getText();
		if (!key && ts.isVariableDeclaration(current)) key = current.name.getText();
		if (!key && ts.isBinaryExpression(current) && current.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
			key = lastName(current.left);
		}
		if (!key && ts.isReturnStatement(current)) key = 'returns';
		if (
			ts.isMethodDeclaration(current) ||
			ts.isGetAccessorDeclaration(current) ||
			ts.isPropertyDeclaration(current) ||
			ts.isConstructorDeclaration(current)
		) {
			member = ts.isConstructorDeclaration(current) ? 'constructor' : current.name.getText();
			break;
		}
		if (ts.isFunctionDeclaration(current) && current.name) {
			member = current.name.text;
			break;
		}
	}
	// A literal nested inside another template (a ternary inside `${...}`) is part of that
	// template's rendering, not a line of its own.
	for (let current = node.parent; current; current = current.parent) {
		if (ts.isTemplateSpan(current)) skip = true;
	}
	const where = [member, key && key !== member ? key : undefined].filter(Boolean).join(' → ');
	return { where: where || 'module', skip };
};

const isProse = (text: string): boolean => /\s/.test(text.trim()) && /[A-Za-z]/.test(text);

/** Every prose literal under `root`, rendered, in source order. */
const extractTemplates = (root: ts.Node, ctx: RenderContext, exclude = RUNTIME_RENDERED): Template[] => {
	const templates: Template[] = [];
	const visit = (node: ts.Node): void => {
		if (
			(ts.isPropertyDeclaration(node) || ts.isGetAccessorDeclaration(node)) &&
			exclude.has(node.name.getText())
		) {
			return;
		}
		if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
		const text = renderLiteral(node, ctx);
		if (text !== undefined) {
			const { where, skip } = locate(node);
			const trimmed = text.replace(/^\n+/, '').replace(/\n+$/, '');
			if (!skip && isProse(trimmed)) templates.push({ where, text: trimmed });
			return;
		}
		node.forEachChild(visit);
	};
	visit(root);
	return templates;
};

/** Module-level arrays of literals: the fill catalogs a monster samples from. */
const fillCatalogs = (source: ts.SourceFile): Array<{ name: string; values: string[] }> => {
	const catalogs: Array<{ name: string; values: string[] }> = [];
	source.forEachChild(node => {
		if (!ts.isVariableStatement(node)) return;
		for (const decl of node.declarationList.declarations) {
			const init = decl.initializer;
			if (!ts.isIdentifier(decl.name) || !init || !ts.isArrayLiteralExpression(init)) continue;
			const values = init.elements.map(element => {
				if (ts.isStringLiteral(element)) return element.text;
				if (ts.isObjectLiteralExpression(element)) {
					return element.properties
						.map(prop =>
							ts.isPropertyAssignment(prop) &&
							(ts.isStringLiteral(prop.initializer) || ts.isNumericLiteral(prop.initializer))
								? prop.initializer.text
								: undefined
						)
						.filter(Boolean)
						.join(' / ');
				}
				return undefined;
			});
			if (values.length && values.every(value => value)) {
				catalogs.push({ name: decl.name.text, values: values as string[] });
			}
		}
	});
	return catalogs;
};

/** Lines outside a card's own file that name it, such as a ward refusal in immobilize.ts. */
const mentionsElsewhere = (cardType: string, ownPath: string): Array<Template & { path: string }> =>
	allSources()
		// constants/ holds effect-type identifiers such as "Gloaming Rest Effect", not prose.
		.filter(file => file.path !== ownPath && !file.path.includes(`${join('src', 'constants')}`))
		.flatMap(file => {
			const ctx = { constants: moduleConstants(file.source) };
			return extractTemplates(file.source, ctx, new Set())
				.filter(({ text }) => text.includes(cardType))
				.map(template => ({ ...template, path: repoPath(file.path) }));
		});

/** A small deterministic PRNG, so the `look at` examples do not churn on every build. */
const seeded = (seed: number): (() => number) => {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

const withSeed = <T>(seed: number, fn: () => T): T => {
	const original = Math.random;
	Math.random = seeded(seed);
	try {
		return fn();
	} finally {
		Math.random = original;
	}
};

const code = (text: string): string => {
	const ticks = text.includes('`') ? '``' : '`';
	const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
	return `${ticks}${pad}${text}${pad}${ticks}`;
};

const cell = (text: string): string => code(text.replace(/\n/g, ' ⏎ ')).replace(/\|/g, '\\|');

const templateTable = (templates: Template[], firstHeader = 'Where'): string[] =>
	templates.length
		? [`| ${firstHeader} | Template |`, '|---|---|', ...templates.map(t => `| ${t.where} | ${cell(t.text)} |`)]
		: ['_None._'];

const fence = (text: string): string[] => ['```text', text.trim(), '```'];

const slugFor = (name: string): string => name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

const displayName = (name: string): string => name.replace(/([a-z])([A-Z])/g, '$1 $2');

export const signatureCardsFor = (creatureType: string): any[] =>
	(allCards as any[]).filter(Card => (Card.permittedClassesAndTypes ?? []).includes(creatureType));

const renderCard = (Card: any): string[] => {
	const located = findClass(Card.name);
	const card = new Card();
	const lines = [`## ${Card.cardType}`, ''];
	if (located) lines.push(`Source: \`${repoPath(located.file.path)}\`.`, '');
	lines.push(`**Card description:** ${code(Card.description ?? '')}`, '');
	if (card.stats) lines.push('**Rules text:**', '', ...fence(card.stats), '');
	if (located) {
		const ctx: RenderContext = {
			constants: moduleConstants(located.file.source),
			icon: card.icon,
			actions: Card.actions,
		};
		lines.push('**Narration and outcomes:**', '', ...templateTable(extractTemplates(located.node, ctx)), '');
		const elsewhere = mentionsElsewhere(Card.cardType, located.file.path);
		if (elsewhere.length) {
			lines.push(
				'**Lines elsewhere that name this card:**',
				'',
				...templateTable(elsewhere.map(({ path, where, text }) => ({ where: `\`${path}\` ${where}`, text }))),
				''
			);
		}
	}
	return lines;
};

export const renderStringsInventory = (Monster: any): string => {
	const name = displayName(Monster.name);
	const slug = slugFor(Monster.name);
	const located = findClass(Monster.name);
	const cards = signatureCardsFor(Monster.creatureType);

	const examples = withSeed(Monster.name.length * 7919, () =>
		Array.from({ length: LOOK_AT_EXAMPLES }, (_, i) => new Monster({ gender: GENDERS[i % GENDERS.length] }).description)
	);

	const lines = [
		'---',
		'type: Reference',
		`title: ${name} strings`,
		`description: Generated review inventory of the ${name}'s flavour copy${cards.length ? ' and its signature cards' : ''}.`,
		'status: stable',
		'audience: internal',
		`tags: [voice, strings, monsters, ${slug}]`,
		'---',
		`# ${name} strings`,
		'',
		`> ${GENERATED_DOC_NOTICE.split('\n').join(' ').replace('pnpm run build:docs', '`pnpm run build:docs`')}`,
		'',
		'A review aid, not a second source of truth: change the source and its tests, then',
		'regenerate. See the [inventory conventions](README.md).',
		'',
		'## Monster copy',
		'',
		located ? `Source: \`${repoPath(located.file.path)}\`.` : '',
		'',
		'### `look at` examples',
		'',
		'Seeded, cycling he, she, and they.',
		'',
		...examples.map(example => `- ${code(example)}`),
		'',
	];

	if (located) {
		const ctx: RenderContext = { constants: moduleConstants(located.file.source) };
		const catalogs = fillCatalogs(located.file.source);
		if (catalogs.length) {
			lines.push(
				'### Fill lists',
				'',
				...catalogs.map(({ name: list, values }) => `- \`${list}\`: ${values.map(code).join(', ')}`),
				''
			);
		}
		lines.push(
			'### Templates',
			'',
			// The `look at` getter is listed too: the examples above show its output, and the
			// template shows every branch the examples may not have drawn.
			...templateTable(extractTemplates(located.node, ctx, new Set(['stats']))),
			''
		);
	}

	lines.push('### Long description', '', ...fence(Monster.description ?? ''), '');

	for (const Card of cards) lines.push(...renderCard(Card));

	return normalizeLineEndings(`${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`);
};

export const collectStringsInventories = (): Record<string, string> =>
	Object.fromEntries(
		(allMonsters as any[]).map(Monster => [
			`${STRINGS_INVENTORY_DIR}/${slugFor(Monster.name)}`,
			renderStringsInventory(Monster),
		])
	);

export const generateStringsInventories = (
	writeFile: (basename: string, content: string, suffix?: string) => void
): void => {
	for (const [path, content] of Object.entries(collectStringsInventories())) writeFile(path, content);
};
