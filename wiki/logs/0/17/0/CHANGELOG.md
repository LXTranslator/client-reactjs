# 0.17.0

The interface for everything the server gained at 0.25.0: a second factor, provider sign
in through github.com and gitlab.com, and the policy pages the product had never had.

Nothing here needs configuring. There is no new `VITE_` variable, and which providers
exist is asked of the server at runtime rather than baked into the build — a build time
flag would be public, static, and free to drift from what the server will actually accept.

## Added

- `src/pages/PrivacyPolicyPage.jsx` and `src/pages/TermsOfServicePage.jsx`, at
  `/privacy-policy` and `/terms-of-service`, reachable signed in and signed out, and
  linked from a new Legal column in the footer.
- `src/pages/TwoFactorPage.jsx` at `/settings/two_factor` — enrol, confirm, disable and
  regenerate recovery codes, each behind the same password confirmation a password change
  takes.
- `src/pages/LinkedAccountsPage.jsx` at `/settings/linked`, and
  `src/pages/OAuthCallbackPage.jsx` at `/oauth-callback`.
- `src/components/account/OAuthProviderButtons.jsx`, which renders **nothing** when the
  server reports no configured provider.
- `src/lib/qrcode.js` and `src/components/ui/QrCode.jsx` — a QR encoder and an inline SVG
  renderer, written here because the served content security policy blocks both a remote
  image and a call to a third party service.
- `validateTotpCode` in `src/lib/validation.js`.
- `tests/policy.test.jsx`, `tests/qrcode.test.js`, `tests/twoFactor.test.jsx` and
  `tests/oauth.test.jsx`. The suite is 297 tests across 16 files, up from 248 across 12.

## Changed

- **`AuthContext.login` now returns a discriminated result.** It previously read
  `access_token` off whatever came back; against a server that answers a challenge instead
  of a session that called `setAuthToken(undefined)` and carried on as though somebody
  were signed in. The failure would have been silent, so there is a test asserting the
  token setter is never called with `undefined`.
- `LoginPage` renders the code step as a second state rather than navigating to a route. A
  route would sit inside `PublicOnlyRoute` and be redirected away the moment the session
  existed, and keeping it here preserves `location.state.from`.
- `validateTranslationFile` mirrors the server's tightened filename rule: no second
  extension in the stem, no path separator, no leading dot, and a 128 character cap. The
  accepted files callout on the upload page was updated in the same change. **An upload
  named `en_us.v2.json` is now refused**, matching the server.
- The footer's account links use the path builders, as the column beside them already did.
- New CSS is limited to `.auth__providers` and `.auth__divider` in `auth/auth.css`.

## Fixed

- `package-lock.json` carried a version field that had drifted from `package.json`.

## Security

Every dependency moved to its latest version, and `npm audit` reports **0 vulnerabilities**
where it previously reported three, one of them high. Neither advisory reached the browser
bundle: `nanoid` arrived through `postcss` through `vite`, and `@vitest/mocker` through
`vitest`, so bumping the two parents cleared both without an override.

- `vitest` 4.1.10 to 5.0.0 and `jsdom` 29.1.1 to 30.0.1, both majors, both dev only, and
  neither needed a configuration change.
- `vite` 8.2.2, `@vitejs/plugin-react` 6.1.1, `react-router` 8.3.1, and the three
  `@testing-library` packages.

Not done deliberately: vitest 5 reports the suite would run about four seconds faster with
`isolate: false`, which reuses workers across files. That changes the isolation the tests
rely on, and this suite already produced one order dependent failure while it was being
written. Trading isolation for four seconds inside a dependency bump is the wrong place to
make that call.

## Notes

**The QR encoder did not work at first, and the way it failed is worth recording.** The
first version produced symbols that looked entirely correct — right size, right finder
patterns, right version — and decoded as nothing at all. Three bugs, found by comparing
module for module against an independent encoder and then decoding the output with two
independent decoders: format information written least significant bit first when position
zero carries bit fourteen; the second copy of that information split after eight positions
instead of seven, putting a format bit where the dark module belongs; and pad codewords
alternating from the running codeword count rather than always starting at `0xEC`.

`tests/qrcode.test.js` pins the exact output as digests, so a change that alters a symbol
has to be justified rather than absorbed.

**Provider avatars are not rendered.** The served policy is `img-src 'self' data:`, so a
github.com avatar URL is blocked by the browser and would show as a broken image. Initials
carry the same recognition without a request that cannot succeed.

**Provider sign in is a full page redirect, never a popup**, because the served headers
set `Cross-Origin-Opener-Policy: same-origin`.
