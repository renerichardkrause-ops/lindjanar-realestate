#!/bin/sh
# Publish any blog post whose date has arrived, then deploy.
#
# Meant to be run unattended, once a day, so it refuses anything ambiguous
# rather than guessing. It will not run on a dirty tree, will not run with
# unpushed commits sitting on the branch, and will not run off main – in each
# of those cases a `git push` would carry someone else's half-finished work
# to a live site along with the day's post.
#
# Safe to run twice and safe on a day with nothing due: the build is driven
# purely by the dates in blog-src/, so it exits without committing. If it
# misses a few days it catches up on the next run rather than losing posts.
#
#   sh tools/blog_publish.sh
set -eu
cd "$(dirname "$0")/.."

fail() { echo "blog_publish: $1" >&2; exit 1; }

branch=$(git rev-parse --abbrev-ref HEAD)
[ "$branch" = "main" ] || fail "on branch '$branch', not main – refusing"

# Someone mid-edit. Their work is not ours to commit.
git diff --quiet || fail "working tree has uncommitted changes – refusing"
git diff --cached --quiet || fail "changes are staged – refusing"

# A plain push sends every local commit, not just ours.
git fetch -q origin main
[ "$(git rev-list --count origin/main..HEAD)" -eq 0 ] \
  || fail "local commits are not pushed yet – refusing, push them first"
[ "$(git rev-list --count HEAD..origin/main)" -eq 0 ] \
  || fail "behind origin/main – pull first"

python3 tools/blog_build.py

# Exactly what the build writes: the post pages and index, the sitemap, and
# the generated blog section inside index.html.
git add blogi sitemap.xml index.html

if git diff --cached --quiet; then
  echo "nothing due today – no commit"
  exit 0
fi

new=$(git diff --cached --name-only --diff-filter=A -- blogi \
      | sed 's|blogi/||; s|\.html$||' | paste -sd ', ' -)
[ -n "$new" ] || new="blog rebuild"

git commit -q -m "Publish: $new"
git push -q
echo "published and pushed: $new"
