---
name: xss
description: Keep attacker controlled content out of the DOM as markup in the LXTranslator client.
---

# Cross Site Scripting Prevention

This application renders content nobody on the team wrote: translation strings
uploaded by users, display names, project descriptions, and text produced by an
AI provider. All of it is attacker controllable.

## The primary defence

**React escapes everything interpolated into JSX.** A translation whose value is
`<img src=x onerror=alert(1)>` renders as those literal characters. That defence
holds as long as nothing bypasses it.

## Rules

1. **Never use `dangerouslySetInnerHTML`.** There is no case in this application
   that needs it. If markup rendering is ever genuinely required, sanitise with
   a maintained library and document why in the same commit.
2. **Never build DOM by hand** with `innerHTML`, `insertAdjacentHTML` or
   `document.write`.
3. **Validate a URL before rendering it as a link or an image source.**
   `validateWebsiteUrl` accepts only `http:` and `https:`. A `javascript:` URL
   in an `href` executes on click, and `data:` URLs can carry markup. Any new
   field holding a URL must go through the same check.
4. **Never pass user content to `eval`, `new Function`, or a `setTimeout`
   string.**
5. **Never interpolate user content into a `style` attribute or a CSS custom
   property.** A crafted value can exfiltrate data through a background image
   request.
6. **Translation values are displayed as text, never parsed.** The editor puts
   them in a `<textarea>` and a `<div>`; neither interprets markup.

## The layered defence

The served bundle carries a content security policy that forbids inline script
and restricts every source to this origin. Even if an injection slipped past
React, the browser refuses to execute it. That is a backstop, not a substitute
for the rules above.

## When adding a component

Ask: does this render a value that originated outside the team? If yes, confirm
it goes through JSX interpolation and not any of the bypasses listed above. If
it is a URL, confirm it passed a scheme check first.
