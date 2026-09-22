# Cách viết / Writing style

> Viết như đang nói với một người bạn vừa tới Đà Nẵng.
> Write the way you'd talk to a friend who just landed in Da Nang.

Tiếng Việt là ngôn ngữ gốc. Tiếng Anh là bản dịch trung thành, không phải viết
lại. Giọng của V1 — mấy câu đùa, `=))`, tiếng lóng — là tài sản của dự án này.
Giữ nguyên trong tiếng Việt, và dịch **ý** sang tiếng Anh.

Vietnamese is the source language. English is a faithful translation, not a
rewrite. V1's voice — the jokes, the `=))`, the slang — is this project's
asset. Keep it in the Vietnamese and translate the *meaning*.

---

## `why_we_go` — phần quan trọng nhất / the part that matters

2–4 câu. Trả lời ba câu hỏi: **khi nào đi**, **gọi món gì**, **vì sao hơn chỗ khác**.

2–4 sentences. Answer three questions: **when to go**, **what to order**, and
**why here rather than somewhere else**.

**Được / Good**

> Mỳ Quảng siêu ngon, chưa ăn chỗ nào ngon hơn và rẻ hơn. Cô sáng nào cũng đi
> từ Quảng Nam ra bán, rau quê nên ăn xả láng. Tô mỳ khổng lồ — nữ ăn nhớ dặn
> bỏ ít mỳ.

Vì sao được: có lý do cụ thể (rau quê, cô từ Quảng Nam), có lời khuyên thật
(tô to quá), và nghe như người thật nói.

Why it works: a concrete reason, a real piece of advice, and it sounds like a
person.

**Không được / Not good**

> Quán ăn ngon, giá cả hợp lý, phục vụ nhiệt tình. Không gian sạch sẽ thoáng
> mát. Rất đáng để thử!

Vì sao không: câu nào cũng đúng với 10.000 quán khác. Không có thông tin nào
giúp người đọc quyết định.

Why it fails: every sentence is true of ten thousand other places. Nothing in
it helps anyone decide.

---

## Luật / Rules

**Nói giá bạn đã trả.** Không phải giá trên menu, không phải giá nghe kể.
Say the price you paid. Not the menu price, not what someone told you.

**Nói điểm trừ.** Chỗ nào cũng có. Không có chỗ ngồi, hay đông quá giờ trưa, hay
chủ khó tính — nói ra. Đây là thứ làm người đọc tin những phần còn lại.
Say the downside. Every place has one. No seating, packed at noon, a grumpy
owner — say it. This is what makes the rest believable.

**Gọi tên món.** "Đồ ăn ngon" là vô nghĩa. "Gà luộc tự xé ăn kèm kim chi" thì có nghĩa.
Name the dish. "The food is good" says nothing. "Hand-torn boiled chicken with
kimchi" says something.

**Không dùng từ ca ngợi mà không có lý do.** "Ngon nhất Đà Nẵng" thì phải nói
ngon nhất so với cái gì, bạn đã thử mấy chỗ.
No superlatives without a reason. "Best in Da Nang" needs to say best compared
to what, and how many you've tried.

**Không chép text quảng cáo.** Không chép từ Facebook quán, từ blog du lịch, từ
bài PR. Nếu nghe như quảng cáo thì nó là quảng cáo.
Never copy marketing text — not from the place's Facebook, not from a travel
blog. If it reads like an ad, it is one.

**Không bao giờ có bài đăng trả tiền.** Quen chủ quán thì khai trong `relationship:`.
Quen biết không sao. Giấu mới là vấn đề.
No paid placements, ever. If you know the owner, disclose it in
`relationship:`. A connection is fine. Hiding it is not.

**Không nêu tên người cụ thể.** "Cô bán mỳ Quảng" được. Tên thật, số điện thoại,
Facebook cá nhân thì không — CI sẽ chặn.
Never name a private individual. "The Mỳ Quảng lady" is fine. A real name, a
phone number or a personal Facebook is not — CI blocks these.

---

## Tiếng Anh / The English

Dịch ý, đừng dịch từng chữ. Giữ tên tiếng Việt của món và đường phố —
người đọc cần tra được trên bản đồ và chỉ cho tài xế.

Translate the meaning, not the words. Keep Vietnamese dish names and street
names as they are — readers need to look them up on a map and point at them
for a driver.

`Mỳ Quảng` chứ không phải "Quang-style noodles". `22 Tố Hữu` chứ không phải
"22 To Huu Street". Giá viết `45k` và giải thích một lần trên đầu file.

`Mỳ Quảng`, not "Quang-style noodles". `22 Tố Hữu`, not "22 To Huu Street".
Prices stay as `45k`, explained once at the top of the file.

Chỉ viết được tiếng Việt cũng không sao — gắn nhãn `needs-translation`. Một
mục viết tốt bằng tiếng Việt hơn hẳn một mục đầy đủ bằng tiếng Anh máy dịch.

Vietnamese-only is fine — label it `needs-translation`. A half-entry in good
Vietnamese beats a full one in machine English.

---

## Mấy trường khác / The other fields

| Trường / Field | Viết gì / What goes in |
| --- | --- |
| `must_try` | Tên món, không phải câu. `Gà luộc tự xé` |
| `hours_notes` | Giờ mở cửa và cảnh báo thật: "8h là hết", "chỉ nhận tiền mặt" |
| `price_vnd` | Khoảng giá bạn trả: `15k–20k`. Chuỗi, không phải số |
| `best_season` | Chỉ điền khác `year-round` khi mùa **thực sự** quan trọng — biển, SUP, hoàng hôn, cánh đồng lúa, món ngày mưa |
| `vibe` | Chọn từ `taxonomy.yml`. Không chắc thì để ít còn hơn đoán |
| `address` | Như người địa phương chỉ đường. Mốc đường còn hữu ích hơn số nhà |
