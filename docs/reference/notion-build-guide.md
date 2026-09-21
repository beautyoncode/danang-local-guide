# 🛠️ Build Guide: Da Nang Local Guide in Notion (English + Vietnamese)

This turns the files in this package into a working, bilingual Notion workspace. Plan on about 2–3 hours for the first version.

**The approach:** one shared set of databases (so each fact is updated once), with English and Vietnamese text in separate columns, and a separate homepage per language that shows only that language.

## What's in the package

| File | What it becomes in Notion |
| --- | --- |
| `Places.csv` | Master database: **62 places** from your `danang-cuisine` README, with EN and VI columns and empty columns ready for photos, dates and ratings |
| `Experiences.csv` | Ready-made outings (**9** drafts), EN and VI |
| `Neighborhoods.csv` | Area guides (**5** starters), EN and VI |
| `01 - Language Hub.md` | Landing page with the language choice |
| `Home (EN).md` / `Home (VI).md` | One homepage per language |
| `How We Recommend (EN).md` / `(VI).md` | Methodology page per language |

> ⚠️ **Everything is marked `Data status = Draft - verify`.** The **Vietnamese** text is condensed from your README. The **English** text is translated from it. Area, Price band, Best session, Vibe and Good for were inferred from the README text and addresses. Check them before publishing or selling.

---

## Step 1: Create one parent page

Create a page called **🌴 Da Nang Local Guide** and keep *everything* inside it. That lets you publish and duplicate the whole thing as one template later.

## Step 2: Import the databases (CSV)

1. Open the parent page. In the sidebar choose **Import → CSV**.
2. Import `Places.csv`, then `Experiences.csv`, then `Neighborhoods.csv`.
3. Move each new database into the parent page.

Vietnamese characters are preserved (UTF-8). Every column arrives as **Text**; you'll set types next. The first column (**Name**) becomes the page title (the Vietnamese name, which matches signs and Google Maps).

## Step 3: Set property types in `Places`

Click the property header → **Edit property** → change **Type**. When you convert Text → Select or Multi-select, Notion creates the options from the values already in the column, and splits multi-select values on commas.

| Property | Type | Notes |
| --- | --- | --- |
| Name | Title | Vietnamese name |
| Type | **Select** | e.g. `🍜 Food · Đồ ăn` |
| Category | **Select** | e.g. `Bún · Noodles`, `Hike · Leo núi` |
| Area | **Select** | e.g. `Hai Chau · Hải Châu` |
| Address | Text | |
| Price (VND) | Text | Ranges like "45k–70k" don't fit a Number |
| Price band | **Select** | ₫ / ₫₫ / ₫₫₫ / ₫₫₫₫ (language-neutral) |
| Best session | **Multi-select** | e.g. `🌅 Early Morning · Sáng sớm` |
| Vibe | **Multi-select** | e.g. `Local · Bản địa` |
| Good for | **Multi-select** | e.g. `Couple · Cặp đôi` |
| Must try (EN) / (VI) | Text | |
| Why we go (EN) / (VI) | Text | Your most valuable columns |
| Hours & notes (EN) / (VI) | Text | |
| Link | **URL** | |
| Data status | **Select** | Draft - verify / Verified |

> 💡 **Why the option names look like "English · Vietnamese":** Notion can't translate select options, so each option carries both languages. Readers in either language can understand every filter and tag.

### Extra columns already in the CSV (mostly empty, ready to fill)

These arrive as Text. Change the type as shown, then fill them in as you verify each place.

| Property | Type | What's pre-filled |
| --- | --- | --- |
| Last checked | **Date** | Empty. Fill in as you verify. Makes it a *living* guide |
| EN reviewed | **Checkbox** | Empty. Tick when a native English speaker has checked the English text |
| Indoor / Outdoor | **Select** | Filled only where the README says so: the 4 bars described as enclosed spaces = Indoor; walks, beach, SUP and hikes = Outdoor. Everything else is blank for you to set (useful for rainy-day views) |
| English friendly | **Select** (Yes / Some / No) | Empty |
| Payment | **Select** (Cash / Card / Both) | Empty |
| Open days | **Multi-select** (Mon–Sun) | Empty |
| Photo | **Files & media** | Empty. Used as the gallery card cover |
| Localness (1-5), Value (1-5) | **Number** | Empty. Optional scorecard; define each on the How We Recommend page |
| Search keywords | **Text** | Filled: the name without accents (e.g. "Bun cha ca"), generated mechanically. Notion's search may not match unaccented text to accented titles, so test this |

When you change a column to Select, put the Vietnamese in the label too if you want it readable to both audiences (for example `Yes · Có`). The same idea applies to Payment (`Cash · Tiền mặt`, `Card · Thẻ`).

Set the same for `Experiences` (Session: Select; Area: Select; Best for: Multi-select) and clean up `Neighborhoods` (all Text is fine).

## Step 4: Create master views for editing

These are for *you*. The visitor-facing views come in Step 7. In `Places`, click **+** next to the view tabs and add:

| View | Layout | Filter | Group / sort |
| --- | --- | --- | --- |
| 📚 All places | Table | none | Sort by Type |
| ✅ Needs checking | Table | Data status = Draft - verify | Sort by Last checked |
| 🌐 Needs EN review | Table | EN reviewed is unchecked | |
| 🗺️ By area | Board | none | Group by Area |

Then, for the visitor experience, these filters give the shortlists (you'll reuse them as linked views in Step 7):

| Shortlist | Filter |
| --- | --- |
| 🍜 Food | Type = Food |
| 💸 Cheap eats | Type = Food **and** Price band = ₫ |
| ☕ Coffee | Type = Coffee |
| 💻 Work-friendly | Type = Coffee **and** Vibe contains Work-friendly |
| 🌅 Early morning / ☀️ Morning / 🌇 Sunset / 🌙 Evening / 🌃 Late night | Best session contains that session |
| 🚶 Walks & sights | Type = Sights & Walks |
| 🌊 Outdoor | Type = Outdoor |
| 🏮 Hoi An | Area = Hoi An |
| ❤️ Date night | Good for contains Couple |

Combining filters is what makes the guide better than a list, e.g. "Food + Dinner + My An + ₫". Use **Filter → Add filter**, or **Advanced filter** for OR logic. Later you can make the public views show only `Data status = Verified`.

## Step 5: Connect the databases (relations)

**Experiences ↔ Places**

1. In `Experiences`, add a property of type **Relation**, choose `Places`, and turn on **Show on Places**. Name it **Stops**.
2. Copy the text from the `Stops (in order)` column and paste it into the relation cells. Notion generally matches pasted text to page titles; add any that don't match by hand. The names in `Stops` were written to match the `Places` titles.

**Neighborhoods ↔ Places (simple approach)**

On each Neighborhood page, add a **linked view of Places** filtered by `Area = that neighborhood`. On a page type `/linked view`, choose **Create linked view of database**, select `Places`, then set layout and filter.

## Step 6: Set up the language layer

The idea: the database holds both languages, but each language's pages show only its own columns.

1. Keep Vietnamese as the **source of truth** (it comes from your README). When you add or change a place, write the VI columns first, then the EN columns.
2. In every **visitor-facing linked view** (Step 7):
   - EN views show: Name, Type, Area, Price (VND), Price band, Must try (EN), Why we go (EN), Hours & notes (EN), Link.
   - VI views show: the same, with the (VI) columns instead.
   - In a view, open **⋯ → Properties** (or the "Customize view" panel) and toggle each property on or off. For Gallery, use **Card preview** and choose which properties appear on cards.
3. Use **Gallery** layout for visitor views. Table headers would show property names such as "Why we go (VI)" in the wrong place, while cards mostly show values.
4. Track review: tick **EN reviewed** when a native English speaker has checked the English text. Because the English is translated from Vietnamese, this is worth doing before you sell.

**Update rule:** if a fact changes (price, hours, closed), change it in *both* language columns and update **Last checked** at the same time. This is the main cost of a bilingual guide, so keep the text short.

## Step 7: Import the pages and build the language homepages

1. Sidebar → **Import → Text & Markdown**, then import all six `.md` files.
2. Move them inside the parent page and rename if you like:
   - `01 - Language Hub` (this is the page you publish and share)
   - `Home (EN)` → **Da Nang Local Guide (EN)**
   - `Home (VI)` → **Đà Nẵng Local Guide (VI)**
   - the two `How We Recommend` pages
3. On the **Language Hub**, turn each "Open" line into a link: type `@`, pick the homepage.
4. On each **homepage**, replace the italic *(In Notion: …)* instructions with real content:
   - **Sessions:** one **linked view of Places** per session (Gallery, filtered by Best session, EN or VI properties as per Step 6).
   - **What do you want to do?:** link each row to a saved view. In the database, open a view tab → **⋯ → Copy link to view**, paste it on the page and choose **Mention page** or **Create bookmark**.
   - **Explore by area:** a linked view of `Neighborhoods` (Gallery). Show the (VI) columns on the Vietnamese page.
   - **Ready-made experiences:** a linked view of `Experiences` (Gallery). Show `Name (VI)` and `Local tip (VI)` on the VI page.
5. Optional polish: drag blocks side by side for columns; add a cover and icon; add a `/button` for quick actions.
6. Link each homepage back to the other language at the top (the first line of each file already says where).

## Step 8: Make a Place page template

In `Places`, click the arrow next to **New → + New template**:

```
## Why we go (EN)

## Why we go (VI)

## Good to know
- Best time:
- Payment:
- Parking:

## Photos
```

Set default `Data status = Draft - verify`. Every new place then starts with both languages in the same shape.

## Step 9: Fill in the content that makes it valuable

1. **Verify** address, hours, prices and the Google Maps link.
2. **Correct the inferred fields:** Area, Best session, Vibe, Good for, Price band.
3. **Rewrite Why we go** in your own voice; add one honest downside where there is one.
4. **Add photos** (gallery cards look empty without them).
5. **Set Last checked** as you verify.
6. **Neighborhoods:** write "What we like / don't like" in both languages.

### Content versus the V1 target

| Content | In this package | V1 target |
| --- | --- | --- |
| Food | 28 | 50–80 |
| Coffee | 18 | 20–30 |
| Nightlife | 5 | 15–20 |
| Sights, walks, outdoor | 10 | 30–40 |
| Neighborhoods | 5 (starters) | 6–10 |
| Experiences | 9 (drafts) | 15–20 |

Not yet in your README: dessert / late-night eating, museums, markets, gyms, coworking, SIM/internet, healthcare, laundry, supermarkets.

## Step 10: Test it as a visitor (in both languages)

1. "It's 7AM, I want a local breakfast." → Early Morning / Morning + Food
2. "Sunset plans with my partner." → Sunset + Couple
3. "Somewhere quiet to work all afternoon." → Coffee + Work-friendly
4. "Cheap dinner near the beach." → Food + Dinner + ₫
5. Open the VI homepage and check that **no English-only text** shows on cards, and the EN homepage shows no Vietnamese-only notes.

## Step 11: Publish and share

1. **Share → Publish** on the parent page (or the Language Hub).
2. Turn on **Allow duplicate as template** if you want people to copy it.
3. Test the public link in an incognito window, in both languages.
4. Distribution options (check each platform's current rules): Notion Marketplace, Gumroad, Lemon Squeezy, or your own site.
5. A simple structure: **free Starter Guide** (20–30 places), a **paid full guide**, later a **Living in Da Nang** add-on.

---

## Adding Korean or Chinese later

Nothing needs restructuring:

1. Add columns: `Why we go (KO)`, `Must try (KO)`, `Hours & notes (KO)` (same for ZH), plus `Name (KO)` if you want translated names.
2. Add the new language to the Language Hub and create a homepage for it.
3. Option labels (Type, Category, Vibe...) will need a third language if you want them readable; the easiest route is to translate them once and rename the options.

---

## ⚠️ Before you sell this

- **Attribution and permission:** your README describes itself as collected by local members and friends. If others contributed, credit them or get their OK before selling.
- **Verify the data:** addresses, prices and hours come from the README and may be out of date. Da Nang's administrative units changed in 2025 (merger with Quảng Nam, as far as I know), so official district names on maps may differ from the informal area names used here.
- **Language quality:** the English is a translation of the Vietnamese; a native English reader should review it. The Vietnamese is condensed from your README, so re-read it for tone.
- **Omitted on purpose:** one seller's personal phone number in the SUP entry, and one link that pointed to the wrong page (Thông Thành) or to the repo itself (Năm Đảnh).
- **Google Maps links:** several are share links; replace them with stable place links where you can.
