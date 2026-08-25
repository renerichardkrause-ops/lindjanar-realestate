#!/bin/sh
# Publish any blog post whose date has arrived, then deploy.
#
# Safe to run every day and safe to run twice: the build is driven purely by
# the dates in blog-src/, so a day that has nothing due changes nothing and
# this exits without a commit. If it misses a few days it catches up on the
# next run rather than losing posts.
#
#   sh tools/blog_publish.sh
set -e
cd "$(dirname "$0")/.."

python3 tools/blog_build.py

git add -A blogi sitemap.xml
if git diff --cached --quiet; then
  echo "nothing due today – no commit"
  exit 0
fi

NEW=$(git diff --cached --name-only --diff-filter=A -- blogi \
      | sed 's|blogi/||; s|\.html$||' | paste -sd ', ' -)
[ -n "$NEW" ] || NEW="blog rebuild"

git commit -q -m "Publish: $NEW"
git push -q
echo "published and pushed: $NEW"
