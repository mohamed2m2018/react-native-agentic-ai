# Security Policy

We take the security of the `react-native-agentic-ai` SDK seriously. This document describes how to report vulnerabilities and what to expect in response.

## Supported versions

| Version | Supported          |
| ------- | ------------------ |
| 0.10.x  | :white_check_mark: |
| < 0.10  | :x:                |

The 0.10.x line receives security fixes until 1.0 GA. Older releases will not be patched — please upgrade.

## Reporting a vulnerability

Report privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability** (GitHub private vulnerability reporting).

Include in your report:

- A description of the issue and its potential impact.
- Steps to reproduce, ideally a minimal proof of concept.
- Affected SDK version(s) and platform (iOS, Android, web).
- Whether the issue affects the SDK, the MCP server, or both.
- Your name / handle for credit (or tell us you prefer to remain anonymous).

Please **do not** open a public GitHub issue, post to social media, or share the details with third parties before we have had a chance to fix the issue.

## What to expect

- **Acknowledgement** within 2 business days.
- **Initial assessment** within 7 days, with severity rating and intended remediation timeline.
- **Coordinated disclosure**: 90-day window from acknowledgement. We may extend this if a fix is more complex; if so we will agree the schedule with you.
- **Public credit** at resolution unless you ask us not to. We maintain a security hall-of-fame in this file once fixes have shipped.

## Scope

In scope:

- The SDK package on npm (`react-native-agentic-ai`).
- The MCP server shipped inside the package (`mcp-server/`).
- Sample applications under `example-*` directories, where a defect would mislead users into an unsafe integration.

Out of scope:

- Findings that require physical access to a user's device.
- Self-XSS, social engineering, or attacks that require an already compromised device.
- Denial of service via volumetric traffic against the public marketing site.
- Outdated browsers / runtimes (we follow current LTS).

## Hall of fame

_(Empty — be the first.)_
