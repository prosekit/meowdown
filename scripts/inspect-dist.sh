#!/bin/bash
#
# Compare the package dist output of the current branch against origin/master.
#
# Usage: run it on a pull request branch with a clean working tree.
#
#   ./scripts/inspect-dist.sh
#
# It builds `origin/master` and commits its dist output to this branch, then
# builds this branch and commits its dist output on top. The last commit
# removes dist again, so the branch content is unchanged. Open the pull
# request's commit list on GitHub and read the `[dev] .js`, `[dev] .d.ts` and
# `[dev] .css` commits to see how the published files changed.
#
# Both revisions are built in this directory, not in a worktree: the CSS
# module class hashes depend on the absolute file path, so building master
# elsewhere would rename every class and bury the real diff.
set -ex

export SKIP_SIMPLE_GIT_HOOKS=1
export SKIP_INSTALL_SIMPLE_GIT_HOOKS=1

cd "$(dirname "$0")/.."

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "The working tree must be clean." >&2
  exit 1
fi

DEV_BRANCH=$(git branch --show-current)
TEMP_BRANCH="temp-$(uuidgen)"

build_and_commit() {
  local label="$1"

  rm -rf packages/*/dist || true
  pnpm install
  pnpm -r --filter './packages/*' run build

  # Remove source maps
  find packages/*/dist -name "*.map" -delete 2>/dev/null || true

  # Stage each file type separately for clearer diffs. Clearing the index
  # entries first captures deletions, since `git add` skips ignored paths.
  git rm -r -q --cached 'packages/*/dist/*.d.ts' 2>/dev/null || true
  git add --force 'packages/*/dist/*.d.ts' 2>/dev/null || true
  git commit --allow-empty -m "chore: ${label} .d.ts"

  git rm -r -q --cached 'packages/*/dist/*.js' 2>/dev/null || true
  git add --force 'packages/*/dist/*.js' 2>/dev/null || true
  git commit --allow-empty -m "chore: ${label} .js"

  git rm -r -q --cached 'packages/*/dist/*.css' 2>/dev/null || true
  git add --force 'packages/*/dist/*.css' 2>/dev/null || true
  git commit --allow-empty -m "chore: ${label} .css"

  git rm -r -q --cached 'packages/*/dist/*' 2>/dev/null || true
  git add --force 'packages/*/dist/*' 2>/dev/null || true
  git commit --allow-empty -m "chore: ${label} other"

  # Drop everything else the build touched, e.g. the `*.module.d.css.ts`
  # files that `cmk` rewrites, so the next checkout starts clean.
  git checkout -- .
}

# Build and commit master dist on a temporary branch
git fetch origin master
git checkout -b "$TEMP_BRANCH" origin/master
build_and_commit "[master]"

# Bring the master dist commits onto the dev branch
git checkout "$DEV_BRANCH"
git cherry-pick --allow-empty "origin/master..${TEMP_BRANCH}"
git branch -D "$TEMP_BRANCH"

# Build and commit dev dist
build_and_commit "[dev]"

# Clean up dist directories
git rm -r -q --cached 'packages/*/dist/*' || true
rm -rf packages/*/dist || true
git commit --allow-empty -m "chore: clean up dist"

# Push
git push
