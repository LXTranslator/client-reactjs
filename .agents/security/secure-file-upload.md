---
name: secure-file-upload
description: Client side upload checks in the LXTranslator client, and their limits.
---

# Secure File Upload

## What the client checks

`validateTranslationFile` in `src/lib/validation.js`, before anything is sent:

| Check | Reason |
|---|---|
| A file was chosen | Avoids an empty request. |
| Extension is `.json` | Catches the obvious mistake immediately. |
| Size is above zero | An empty file cannot be a locale document. |
| Size is within the limit | Avoids uploading megabytes that will be refused. |

The `<input>` also carries `accept=".json,application/json"`, which filters the
system file picker.

## What these checks are, and are not

**They are convenience.** Every one can be bypassed by calling the API directly,
and the file picker `accept` attribute is a hint the browser may ignore.

The server repeats all of them and adds the checks that actually matter:

* MIME type against an allowlist.
* Full filename sanitisation, rejecting traversal, control characters and
  reserved names.
* Storage under a generated identifier, so the client filename never becomes a
  path.
* Content verification: the bytes must parse as a JSON object.
* Depth and key count ceilings against documents built to exhaust the parser.

## Rules

1. **Never treat a client check as the control.** If a new restriction matters,
   it must exist on the server. Add it here too, for the faster feedback.
2. **Keep the two in step.** `MAX_UPLOAD_BYTES` in the upload page mirrors the
   server's `UPLOAD_MAX_BYTES`. If one changes, change the other, or a user is
   told a file is fine and then sees it rejected.
3. **Never read a file's contents to make a security decision.** Parsing an
   uploaded file in the browser to decide whether to send it just moves work to
   the client; the server has to do it anyway.
4. **Do not set `Content-Type` on a multipart request.** The browser must set
   the boundary itself. `apiRequest` deliberately omits the header when a
   `FormData` body is present.
5. **Surface the server's rejection clearly.** The upload page renders the
   server's message, which names the actual failure, rather than a generic one.

## Drag and drop

The dropzone accepts a dropped file and runs the same validation as the picker.
It is a real focusable control with keyboard activation, so the feature is not
mouse only.
