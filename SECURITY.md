# Security policy

PWF files are shared between apps, so every renderer and tool treats them as untrusted input. A document that can crash, hang or attack a renderer or the reference tools is a security issue. One example is a document that passes validation but expands into an enormous timeline.

## Reporting a vulnerability

Please report security issues privately, not in a public issue:

- Use GitHub's private vulnerability reporting: open the **Security** tab and choose **Report a vulnerability**.
- Or email maintainers@portableworkout.org.

We'll acknowledge a report within 7 days and keep you updated until it's resolved.

## Supported versions

PWF is a pre-release draft. Only the latest commit on `main` is supported.
