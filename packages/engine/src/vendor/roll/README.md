# Vendored `roll` (MIT)

This directory contains a vendored copy of [node-roll](https://github.com/troygoode/node-roll) (MIT license, originally `roll@1.3.2`).

The upstream implementation kept mutable module-level scratch (`filler`, `sumResult`, `cleaner`) that corrupted nested dice rolls. The fork moves that state onto each `Roll.prototype.roll` invocation so combat RNG stays correct under nested parses.
