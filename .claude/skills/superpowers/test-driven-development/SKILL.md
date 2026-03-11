---
name: test-driven-development
description: Use when implementing any feature or bugfix, before writing implementation code
---

# Test-Driven Development (TDD)

## Overview
Write the test first. Watch it fail. Write minimal code to pass.

**The Iron Law:** NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.

Write code before the test? Delete it. Start over.

## Red-Green-Refactor

### RED - Write Failing Test
Write one minimal test showing what should happen.

Confirm:
- Test fails (not errors)
- Failure message is expected
- Fails because feature missing (not typos)

### GREEN - Minimal Code
Write simplest code to pass the test. Don't add features, refactor other code, or "improve" beyond the test.

Confirm:
- Test passes
- Other tests still pass
- Output pristine (no errors, warnings)

### REFACTOR - Clean Up
After green only:
- Remove duplication
- Improve names
- Extract helpers

Keep tests green. Don't add behavior.

## Key Principles
- **Minimal** - One test, one thing.
- **Shows Intent** - Demonstrates desired API.
- **Pragmatic** - TDD is faster than debugging logic errors.
- **Fail First** - If you didn't watch it fail, you don't know if it tests the right thing.
