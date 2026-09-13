# Third-party notices

The runtime uses the following npm packages. Versions are pinned by
`package-lock.json` and their licenses remain with the respective projects:

| Package | Version | License | Source |
| --- | --- | --- | --- |
| `@honcho-ai/sdk` | 2.4.0 | Apache-2.0 | <https://github.com/plastic-labs/honcho> |
| `zod` | 4.0.0 | MIT | <https://github.com/colinhacks/zod> |

The plugin sends session turns to a user-configured Honcho service over HTTPS.
That service is external to this repository and is governed by the service
operator's terms and privacy policy. No credentials are bundled or published.
