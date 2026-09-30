# Security

## Reporting a problem

Please don't report security problems in public issues.

Use GitHub's private vulnerability reporting instead: go to the [Security tab](https://github.com/uptosolve/markdrift/security) of this repo and click **Report a vulnerability**. Only the maintainers can see the report. Include what you found, how to reproduce it, and which browser and version you used.

We'll reply on the report as soon as we can, and let you know when a fix is live. If you'd like credit in the fix, say so in the report.

## What counts

MarkDrift has no server, no accounts and no uploads. Everything happens in the page, on the user's device. The problems that matter most are the ones that break that:

- anything that makes the page send a user's files, frames or settings to another host
- a way for a crafted video, image or logo file to run script in the page
- a dependency that has been compromised or is known to be vulnerable
- the dev-only routes in `vite.config.js` (`/__save`, `/__media`) turning up in a production build

## Supported versions

Only the current code on the `main` branch, which is what runs at https://uptosolve.com/tools/.
