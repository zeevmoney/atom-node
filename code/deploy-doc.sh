#!/usr/bin/env bash

set -e # Exit with nonzero exit code if anything fails

SOURCE_BRANCH="master"
TARGET_BRANCH="gh-pages"

rm -rf apidoc/
git clone -b $TARGET_BRANCH --single-branch https://github.com/ironSource/atom-node.git apidoc
apidoc -i src/ -o apidoc/
cd apidoc
git add .
git commit -m "Deploy to GitHub Pages"
git push
rm -rf apidoc/
