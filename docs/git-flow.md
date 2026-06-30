# Git Flow

This project uses a classic Git Flow branching model.

## Long-Lived Branches

### `master`

`master` is the production and package provenance branch.

- Contains only released code.
- Receives completed releases from `release/*` branches.
- Receives urgent production fixes from `hotfix/*` branches.
- Each release commit on `master` must have a semver tag, for example `v1.1.5`.

Do not commit feature work directly to `master`.

### `legacy/v1`

`legacy/v1` preserves the historical `icore@0.1.38` codebase.

- Points to the final legacy package state.
- Must remain available for provenance and historical reference.
- Must not receive new development work.
- Must be pushed before any cleanup or replacement of legacy files.

### `develop`

`develop` is the integration branch for active development.

- New feature branches start from `develop`.
- Completed feature branches are merged back into `develop`.
- Release branches start from `develop`.
- Hotfix branches are merged back into `develop` after they are released from `master`.

Do not release directly from `develop`.

## Short-Lived Branches

### `feature/*`

Use `feature/*` branches for regular development work.

Naming:

```bash
feature/<short-description>
```

Example:

```bash
feature/restore-public-api
```

Flow:

```bash
git switch develop
git switch -c feature/restore-public-api

# make changes, run checks
git add .
git commit -m "fix: restore public API"

git switch develop
git merge --no-ff feature/restore-public-api
git branch -d feature/restore-public-api
git push origin develop
```

### `release/*`

Use `release/*` branches to prepare a version for release.

Naming:

```bash
release/v<major>.<minor>.<patch>
```

Example:

```bash
release/v1.1.5
```

Allowed changes on a release branch:

- Version bump.
- Changelog or release notes.
- Release-only documentation.
- Small release blockers found during validation.

Do not add unrelated feature work to a release branch.

Flow:

```bash
git switch develop
git switch -c release/v1.1.5

# version/changelog/release fixes, run checks
git add .
git commit -m "chore: prepare release v1.1.5"

git switch master
git merge --no-ff release/v1.1.5
git tag -a v1.1.5 -m "Release v1.1.5"

git switch develop
git merge --no-ff release/v1.1.5

git branch -d release/v1.1.5
git push origin master develop --tags
```

### `hotfix/*`

Use `hotfix/*` branches only for urgent fixes to released code.

Naming:

```bash
hotfix/v<major>.<minor>.<patch>
```

Example:

```bash
hotfix/v1.1.6
```

Flow:

```bash
git switch master
git switch -c hotfix/v1.1.6

# make fix, run checks
git add .
git commit -m "fix: correct production issue"

git switch master
git merge --no-ff hotfix/v1.1.6
git tag -a v1.1.6 -m "Release v1.1.6"

git switch develop
git merge --no-ff hotfix/v1.1.6

git branch -d hotfix/v1.1.6
git push origin master develop --tags
```

## Tags

Every released version must be tagged from `master`.

Use annotated tags:

```bash
git tag -a v1.1.5 -m "Release v1.1.5"
git push origin --tags
```

Do not move release tags after they have been pushed.

## Merge Policy

Use merge commits for branch completion:

```bash
git merge --no-ff <branch>
```

This preserves the historical branch structure and matches the existing repository history.

## Current Historical Baseline

The repository preserves the old npm package history before new development:

- `master` points to the final legacy release commit `3048f15`.
- `legacy/v1` points to the same final legacy release commit `3048f15`.
- npm `icore@0.1.38` was published from commit `3048f15`.
- New alpha development starts from `develop`, not from `master`.

Do not delete or rewrite `legacy/v1`. If a future `main` branch is introduced,
decide that as a separate repository migration and keep `legacy/v1` intact.
