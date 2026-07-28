# Non-Functional Requirements

> Type: Policy. This document defines the non-functional properties of the project that a working change must not violate.

Changes must not break:

- build reproducibility
- determinism
- portability
- CI

Compatibility-sensitive properties must remain unchanged unless the task
explicitly requires changing them:

- runtime behavior
- file structure
- startup order
- architecture
- dependency graph

When the task requires one of these changes, keep it scoped and validate its
effect explicitly. Even if the code works, a change is forbidden when it
damages an unrelated property.

## Risk Examples

- the build passes locally but depends on file ordering in a specific OS
- the code works but changes the location of output artifacts
- the change does not break logic but adds a dependency on shell-specific behavior
- tests pass but the component startup order becomes different

## Good Practices

- verify not only result correctness but also preservation of previous side effects
- avoid changes that bind the project to a specific execution environment
- separately evaluate the impact of a change on CI, file structure, and reproducibility
