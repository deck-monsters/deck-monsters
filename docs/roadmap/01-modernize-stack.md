# Modernize Node.js and Dependencies

**Category**: Tech Debt / Modernization  
**Priority**: High (blocker for most other work)

## Background

The engine was written targeting Node.js 8, which has been EOL since 2019. Several dependencies are also significantly outdated. This is a prerequisite for CI setup and for anyone outside the original team to run tests.

## Tasks

- [ ] Upgrade Node.js target to current LTS (v22); add `.nvmrc` and `engines` field to `package.json`
- [ ] Replace `@salesforce-mc/devtest` (internal Salesforce test runner) with a standard Mocha + Chai + Sinon setup
- [ ] Audit and upgrade all npm dependencies
- [ ] Replace `moment` with `date-fns` or native `Temporal` (moment is in maintenance mode)
- [ ] Replace lodash piecemeal imports with native ES2020+ equivalents where reasonable
- [ ] Replace `bluebird` promise chains with native `async/await` throughout
- [ ] Upgrade `aws-sdk` v2 → `@aws-sdk/client-s3` v3 (v2 in maintenance mode)
- [ ] Replace Salesforce ESLint config with a standard config (e.g., `eslint:recommended` + prettier)
- [ ] Set up CI with GitHub Actions to run tests on every PR

## Notes

The `@salesforce-mc/devtest` package is the biggest single blocker — it is an internal Salesforce package and unavailable publicly. Replacing it with a standard test setup is a prerequisite for all other CI work.
