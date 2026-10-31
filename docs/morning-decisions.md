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

## 3. Post-event

- Rotate David's password (it was used by the demo scripts through environment variables).
- `infra/rag-teardown.sh` after the hackathon (RagManagedDb bills while it exists).
