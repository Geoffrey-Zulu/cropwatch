# Morning decisions (night of 31 Oct to 1 Nov)

Items that need Geoffrey's judgment. Nothing here has been done; each says what is ready and what the choice is.

## 1. Make the branch judges see the current one (do this first, 2 minutes)

`main` is the repository's default branch, so it is what a judge browsing GitHub sees. It is 89 commits behind `ceih` and still shows the template's README. `main` is an ancestor of `ceih`, so this is a fast-forward with no merge and no rewrite:

```bash
git push origin ceih:main
gh repo edit --description "Phytos: verification and ledger layer for outgrower agribusinesses in Zambia (GreenCode Hackathon 2026)" --homepage https://crop-watch01.web.app
```

Not done overnight, because it changes what the public sees and the day-branch rule merges to `main` at acceptance.

## 2. Older commit messages

104 pushed commits on `ceih` (29 also on `main`) end with a co-author trailer; commits since 22:56 on 31 Oct have none. Removing them rewrites history: force pushes of `ceih` and `main`, tags re-created, every clone re-cloned. Safest after the pitch:

```bash
git filter-repo --message-callback 'import re; return re.sub(rb"\n+Co-Authored-By:[^\n]*", b"", message)' --force
git push --force-with-lease origin ceih main && git push --force origin --tags
```

## 3. Fields map: who sees farm-level outlines

Amended invariant 6 limits field outlines to the contracting agribusiness. The order asked for its `credit` and `field_officer` roles only. There is no `credit` account, and creating accounts is yours to do, so a Command Center account (David) also sees fields, but only on a simulated org (`canSeeFields` in `apps/functions/src/services/ceih/season.ts`). If you create a credit user for the demo org, strict mode is a one-line change.

## 4. Maker-checker: the requester should not be able to approve

Invariant 11 asks for approval "by a user who did not perform the verification", and that is enforced: the officer who verified the field cannot approve. The credit-manager review asks for more: the person who requested the advance, or typed in the farmer's code, should not approve it either. Today one Command Center login (David) requests, confirms and approves on stage.

Enforcing it is a small rule change (`checkApprove` also refusing `requested_by`, plus recording who entered the code), but the live demo would then need **a second account** to approve. Creating accounts is yours to do. Options:

- (a) Leave it for the pitch, and say "a second person approves" while presenting with two people at one laptop.
- (b) Create a credit-team account for the demo org, and I enforce the rule and switch beats 5 and 6 to it.

## 5. Rule and robustness items from the credit-manager review (not built overnight)

These change rules or the money path, so they wait for the team. Each is small.

- **Drought cover for fields that held.** The drought flag marks every shortfall in the camp uncontrollable, including the 3 of 40 fields whose own curve held. A tighter rule would mark only fields whose own passes fell, and read "camp flagged, field held: review" for the rest. This is a rule change (invariant 12), so it is yours.
- **Moisture.** Moisture is recorded but not priced: 720 kg at 22% is paid as dry grade A. It needs a standard (13% for soya?) and a maximum. This is a rule change.
- **A limit on code attempts.** Today a wrong code is refused but can be retried for the code's 30 minutes. Proposed: decline after 5 wrong codes and tell the farmer.
- **Disbursement order.** The provider is called before the advance is claimed. That is harmless on the simulated provider, but it must change before any real adapter: commit a pending disbursement first, and pass the advance id as the idempotency key.
- **One delivery per contract.** A second load cannot be recorded.
- **"soya" is fixed** in three card strings; a maize contract would read wrong.
- **Maturity read as stress.** In June most Chikuni fields show "stress" on the map, because greenness falls at maturity. The storyline shows the map in March, but the status rule should learn the season's end.

## 6. Post-event

- Rotate David's password (it was used by the demo scripts through environment variables).
- `infra/rag-teardown.sh` after the hackathon (RagManagedDb bills while it exists).
