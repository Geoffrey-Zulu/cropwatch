# Morning decisions (night of 31 Oct to 1 Nov)

Items that need Geoffrey's judgment. Nothing here has been done; each says what is ready and what the choice is.

## 1. Scrub the old commit trailers

104 pushed commits on `ceih` (29 of them also on `main`, from 21 Oct onwards) end with a `Co-Authored-By: Claude …` trailer. New commits since 22:56 on 31 Oct carry none. Removing the old ones rewrites history and needs a force push of `ceih` and `main`, which moves every tag's commit too (tags would have to be re-created and force-pushed) and breaks anyone's local clone.

Ready to run once you say so, after the pitch is safest:

```bash
git filter-repo --message-callback 'import re; return re.sub(rb"\n+Co-Authored-By: Claude[^\n]*", b"", message)' --force
git push --force-with-lease origin ceih main && git push --force origin --tags
```

## 2. Fields map: who sees farm-level outlines

Amended invariant 6 limits field outlines to the contracting agribusiness. The order asked for its `credit` and `field_officer` roles only. There is no `credit` account, and creating accounts is yours to do, so a Command Center account (David) also sees fields, but only on a simulated org (`canSeeFields` in `apps/functions/src/services/ceih/season.ts`). If you create a credit user for the demo org, strict mode is a one-line change.

## 3. Maker-checker: the requester should not be able to approve

Invariant 11 asks for approval "by a user who did not perform the verification", and that is enforced: the officer who verified the field cannot approve. The credit-manager review asks for more: the person who requested the advance, or typed in the farmer's code, should not approve it either. Today one Command Center login (David) requests, confirms and approves on stage.

Enforcing it is a small rule change (`checkApprove` also refusing `requested_by`, plus recording who entered the code), but the live demo would then need **a second account** to approve. Creating accounts is yours to do. Options:

- (a) Leave it for the pitch, and say "a second person approves" while presenting with two people at one laptop.
- (b) Create a credit-team account for the demo org, and I enforce the rule and switch beats 5 and 6 to it.

## 4. Post-event

- Rotate David's password (it was used by the demo scripts through environment variables).
- `infra/rag-teardown.sh` after the hackathon (RagManagedDb bills while it exists).
