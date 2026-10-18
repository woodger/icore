# Naming Policy

> Type: Policy. This document defines naming rules for code entities.

## Goal

Names in code must be consistent, predictable, and must not create false semantic signals.

Name notation must reflect the entity role, not the author's personal preference.

## Basic Naming Rules

TypeScript/JavaScript code uses the following rules:

- `camelCase` - variables, functions, values, exported const values;
- `PascalCase` - classes, types, interfaces, enums;
- `kebab-case` - public CLI command and option names, and file names;
- `SCREAMING_SNAKE_CASE` / `ALL_CAPS` - forbidden for internal project identifiers.

## Numeric Values

A numeric literal may remain inline only when its meaning is obvious from the immediate context, such as `0`, `1`, an array index, or a simple arithmetic adjustment.

Intervals, limits, batch and queue sizes, percentages, coefficients, precision, validation bounds, and protocol codes must use named constants. The name must state the purpose and unit.

Move a value that configures behavior into configuration. When an external contract specifies a number, use an existing enum, named constant, or a local name that identifies that contract.

Add a comment only when the name alone does not explain the number's origin or why that value was selected. Do not mechanically extract obvious local values when doing so makes the code less readable.
