# Changelog

Release notes for Kellyville. `/releasenow` adds a section here for every release, and the GitHub release notes are
taken from it.

## Unreleased

### Added
- Installable app with offline play: a web app manifest, icons and a service worker (`sw.js`), wired in by `build.py`.
- An Android app (APK) and a Windows installer with every release.
- A beta at `/beta/` with its own farm save.
- A browser smoke test (`npm test`) that runs on every pull request.

### Changed
- Releases go through the shared Krazow release kit (`/releasenow`, then `/releasenow promote`).
