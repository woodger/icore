# Code Organization Policy

> Type: Policy. This document defines declaration placement and helper ownership.

## Types And Interfaces

Where possible, place `type` and `interface` declarations at the beginning of the file, after imports and before constants, functions, classes, and other executable code.

Types that use `typeof` may refer to declarations that appear later in the same scope.

Keep local types and interfaces in their existing scope, at the beginning of the corresponding block.

Move associated comments together with their declarations. Preserve the order of executable code, including initialization.

## Class Helpers

When a `.ts` file contains a class, its non-exported module-level helper functions belong to that class. Place them inside the class as `private` methods or `private static` methods.

Keep exported functions that are part of the module's public contract. Keep nested functions and callbacks in their existing scope.
