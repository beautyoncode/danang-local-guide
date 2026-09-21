# Contributing

Thanks for adding to the guide. Everything here is written by people who
actually went.

> ## ⚠️ Read this first: the repo wins, Notion does not
>
> `content/**/*.yml` is the single source of truth. The Notion workspace and
> both READMEs are **generated views** of it.
>
> **Any edit you make in Notion to a synced property is overwritten on the next
> merge.** Edit the YAML, not Notion. The sync is one-way by design — two-way
> sync needs conflict resolution and is where projects like this die.
>
> These Notion properties are *not* synced and are safe to curate by hand:
> `Photo`, `EN reviewed`, `Localness`, `Value`, `Indoor / Outdoor`,
> `English friendly`, `Payment`, `Open days`, `Search keywords`, and every page
> **body**. The sync never touches page bodies at all, so photos and notes you
> add inside a page survive every run.

## Three ways in — pick the easiest one for you

| You are | Do this |
| --- | --- |
| Anyone, no GitHub account | Fill in the **public form** (link in the README). It opens an issue for us to review. |
| You have GitHub, don't want to touch files | **Issues → New issue → Add a place.** |
| You're comfortable with Git | Open a PR against `content/`. |

All three land in the same shape, so review is the same work either way.

## Adding a place by PR

One file per place: `content/places/<slug>.yml`. Copy a neighbour and edit it.

```yaml
slug: my-quang-via-he-ha-than      # immutable, matches the filename
name: Mỳ Quảng Vỉa Hè (Hà Thân)     # the name on the sign
type: food                          # keys come from content/taxonomy.yml
category: my-quang                  # must belong to the type above
area: son-tra
address: 22 Tố Hữu
price_vnd: "15k–20k"                # a string: ranges don't fit a number
price_band: "1"                     # 1..4
best_session: [early-morning, morning]
best_season: [year-round]           # [summer] for beach/SUP, [autumn] for rainy-day food
vibe: [street-food, local]
good_for: [solo]
why_we_go:
  vi: Mỳ Quảng siêu ngon, chưa ăn chỗ nào ngon hơn và rẻ hơn...
  en: Best and cheapest Mỳ Quảng we know...
link: https://maps.app.goo.gl/...
status: draft                       # draft | verified | closed
last_checked: 2026-09-21
relationship: none                  # none | owner | family-or-friend
contributed_by: [your-github-handle]
```

**Every value must be a key in [`content/taxonomy.yml`](content/taxonomy.yml).**
CI rejects anything else, so the Notion databases can never grow junk options.
Need a key that doesn't exist? Add it to `taxonomy.yml` in the same PR and say
why.

Before opening the PR:

```bash
npm install
npm run check
```

That runs the same validator CI runs, regenerates the READMEs, and checks the
public form still lines up with the schema. **Commit the regenerated
`README.md` and `versions/README.en.md`** — CI fails if they're stale.

## What we check

Mechanical, by CI: YAML parses, required fields present, every enum value
exists, `slug` unique and matches the filename, experience `stops` resolve to
real places, no phone numbers or emails in prose, `last_checked` is a real past
date, no link shorteners, no near-duplicate of an existing entry.

By a human, and this is the part that matters:

- The note says **when to go and what to order** — not "the food is good".
- **One honest downside** where one exists.
- The price is what you actually paid.
- The Maps link opens the right place.
- You have been there **in person**.

## How writing should sound

Vietnamese is the source language; English is a faithful translation, not a
rewrite. V1's voice — the jokes, the `=))`, the local slang — is the asset.
Keep it in the Vietnamese and translate the *meaning*.

2–4 sentences for `why_we_go`. Name the dish and the price you paid. Say the
downside. No superlatives without a reason, no copied marketing text.

**No paid placements, ever.** If you own the place, or a friend or relative
does, set `relationship:` accordingly. That's not disqualifying — hiding it is.

If you can only write the Vietnamese, do that and label the PR
`needs-translation`. A half-entry in good Vietnamese beats a full one in
machine English.

## `status`, and why nothing you merge is published immediately

- `draft` — on merge. This is where every entry starts.
- `verified` — a steward or maintainer has been there, or cross-checked it.
- `closed` — gone. **Keep the file** so nobody re-adds it; the Notion page is
  archived automatically.

The public Notion views filter to `verified`, so a merge never immediately
publishes an unchecked claim. Entries older than 180 days get flagged for
re-checking.

## Licence

Content is [CC BY-NC-SA 4.0](LICENSE-CONTENT); code is [MIT](LICENSE-CODE).
By contributing you agree to the contributor grant in `LICENSE-CONTENT` —
including that the project may use your contribution in paid products, with
credit. Read it before your first PR.
