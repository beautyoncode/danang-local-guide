# Public submission form — setup

Anyone can add a place from their phone with no GitHub account. A submission
creates a **GitHub issue**, never content: nothing reaches the repo, the README
or Notion until a maintainer opens a PR and CI passes.

## 1. Build the form

Create a form at [forms.google.com](https://forms.google.com). **Question titles
must match exactly** — `Code.gs` looks them up by title and emails you if one is
renamed. Copy-paste them from here.

| # | Question title (paste verbatim) | Type | Required | Options |
| --- | --- | --- | --- | --- |
| 1 | `Tên quán / Place name` | Short answer | ✅ | — |
| 2 | `Địa chỉ hoặc link Google Maps / Address or Google Maps link` | Short answer | ✅ | — |
| 3 | `Loại / Type` | Multiple choice | ✅ | `Đồ ăn / Food` · `Cà phê / Coffee` · `Bar, pub / Nightlife` · `Spa & massage / Wellness` · `Đi dạo, tham quan / Sights & walks` · `Ngoài trời / Outdoor` |
| 4 | `Khu vực / Area` | Multiple choice | ✅ | `Hải Châu` · `Sơn Trà` · `Mỹ An` · `Liên Chiểu` · `Hòa Xuân` · `Hội An` |
| 5 | `Giá khoảng bao nhiêu? / Roughly how much?` | Short answer | — | help text: `ví dụ / e.g. 15k–25k` |
| 6 | `Thời điểm nên đi / Best time of day` | Checkboxes | — | `Sáng sớm (4:30–7AM)` · `Buổi sáng (7–11AM)` · `Buổi trưa (11AM–2PM)` · `Buổi chiều (2–5PM)` · `Hoàng hôn (5–6:30PM)` · `Bữa tối (6–9PM)` · `Buổi tối (7–11PM)` · `Khuya (sau 11PM)` |
| 7 | `Mùa nào đẹp nhất? / Best season` | Checkboxes | — | `Quanh năm / Year-round` · `Mùa xuân (2–4) / Spring` · `Mùa hè (5–8) / Summer` · `Mùa thu, mùa mưa (9–11) / Autumn, rainy` · `Mùa đông (12–1) / Winter` |
| 8 | `Nên gọi món gì? / What should you order?` | Short answer | — | — |
| 9 | `Vì sao bạn thích chỗ này? / Why do you go?` | Paragraph | ✅ | help text: `2–3 câu. Nói thật, đừng quảng cáo. / 2–3 sentences. Honest, not an ad.` |
| 10 | `Bạn đi gần đây nhất khi nào? / When did you last go?` | Date | ✅ | — |
| 11 | `Điểm trừ / Any downside` | Paragraph | — | — |
| 12 | `Bạn có liên quan tới quán không? / Your relationship to the place` | Multiple choice | ✅ | `Không liên quan / No relationship` · `Mình là chủ quán / I own it` · `Người thân hoặc bạn bè / Family or friend` |
| 13 | `Ảnh / Photos` | File upload | — | images only, max 3 |
| 14 | `Tên để ghi nhận / Name for credit (optional)` | Short answer | — | — |

Add this to the form description, in both languages — it is the contributor
grant, and it is the only place a form submitter sees it:

> Bằng việc gửi, bạn đồng ý chia sẻ nội dung này theo giấy phép CC BY-NC-SA 4.0
> và cho phép dự án dùng nó trong các sản phẩm có thu phí, có ghi nhận đóng góp.
>
> By submitting you agree to license this under CC BY-NC-SA 4.0 and to let the
> project use it in paid products, with credit. See LICENSE-CONTENT.

Settings → **do not** collect email addresses. Leave responses anonymous; field
14 is the opt-in for credit.

## 2. Wire up the script

1. Form → **Responses** → link to a **Google Sheet**.
2. In that sheet: **Extensions → Apps Script**.
3. Replace the contents of `Code.gs` with [`Code.gs`](./Code.gs) from this folder.
4. **Project Settings → Script Properties**, add:
   - `GH_TOKEN` — a fine-grained PAT ([github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens)),
     scoped to **this repository only**, permission **Issues: read & write**, nothing else.
   - `GH_REPO` — `GraphicDThanh/danang-local-guide`
5. **Triggers** (clock icon) → **Add trigger**:
   - function `onFormSubmit`, source **From spreadsheet**, event **On form submit**.
   - This must be the *installable* trigger. The simple one cannot call `UrlFetchApp`.
   - Authorize when prompted (it asks for external requests + send email as you).
6. Run `testConnection` once from the editor. It creates a throwaway issue —
   close it. If it fails, the token or `GH_REPO` is wrong.

Never paste the token into the form, a page, or this repo. Rotate it by editing
the Script Property; the form itself never changes.

## 3. Check it

- Submit from a browser **signed out of Google entirely**.
- An issue should appear within seconds, labelled `via-form` `needs-triage`,
  with a YAML block ready to save as `content/places/<slug>.yml`.
- Then break it on purpose: revoke the PAT and submit again. You get an email,
  the response stays in the sheet, and re-running the trigger on that row
  creates the issue. Nothing is lost.

`node src/test-form-script.mjs` runs `Code.gs` against a sample submission
and feeds its output through the real validator — run it after editing either
the form questions or `content/taxonomy.yml`.

## If it gets spammy

In order, stop at the first step that works:

1. The `possible-spam` label already flags any submission with a URL in the prose.
2. Form settings → limit to 1 response per Google account (requires sign-in).
3. Close the form; GitHub Issue Forms still work for anyone with an account.
