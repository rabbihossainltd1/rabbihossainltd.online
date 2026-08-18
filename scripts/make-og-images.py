#!/usr/bin/env python3
"""
Generate 1200x630 Open Graph share cards.

Every page had zero og:image, so any link shared on WhatsApp, Messenger or
Facebook rendered as a bare grey box. For a business whose customers arrive
through those apps that is the single most expensive gap on the site.

Cards are drawn to match the V3 monochrome theme so a shared link looks like
the site it opens.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "images" / "og"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 1200, 630
BG = (8, 8, 8)
FG = (247, 247, 244)
MUTED = (150, 150, 146)
RULE = (44, 44, 44)

BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


def font(path, size):
    return ImageFont.truetype(path, size)


def wrap(draw, text, fnt, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if draw.textlength(trial, font=fnt) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


# page slug -> (headline, supporting line)
CARDS = {
    "default": ("Premium Digital Services in Bangladesh",
                "Premium apps · Game top-up · Cards · Web development"),
    "services": ("Digital Services & Pricing",
                 "ChatGPT · Canva · Netflix · Free Fire · Visa/Mastercard"),
    "portfolio": ("Selected Work",
                  "Websites, Android apps and security audits"),
    "about": ("MD Rabbi Hossain",
              "Web developer · Ethical hacker · Digital services"),
    "faq": ("Frequently Asked Questions",
            "Orders, payments, delivery and support"),
    "terms": ("Terms & Conditions", "RabbiHossainLTD"),
    "privacy-policy": ("Privacy Policy", "RabbiHossainLTD"),
    "refund-policy": ("Refund Policy", "RabbiHossainLTD"),
    "delivery-policy": ("Delivery Policy", "RabbiHossainLTD"),
}


def build(slug, headline, sub):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # subtle corner wash so the card is not a flat rectangle
    for i in range(300):
        a = int(10 * (1 - i / 300))
        d.line([(W - 300 + i, 0), (W, i)], fill=(8 + a, 8 + a, 8 + a))

    pad = 80

    # brand
    f_brand = font(BOLD, 26)
    d.text((pad, pad), "RABBIHOSSAINLTD", font=f_brand, fill=FG)
    bw = d.textlength("RABBIHOSSAINLTD", font=f_brand)
    d.line([(pad, pad + 44), (pad + bw, pad + 44)], fill=RULE, width=2)

    # headline, shrinking until it fits three lines
    size = 78
    while size > 40:
        f_head = font(BOLD, size)
        lines = wrap(d, headline, f_head, W - pad * 2)
        if len(lines) <= 3:
            break
        size -= 6
    f_head = font(BOLD, size)
    lines = wrap(d, headline, f_head, W - pad * 2)

    lh = size + 14
    y = pad + 150
    for ln in lines:
        d.text((pad, y), ln, font=f_head, fill=FG)
        y += lh

    # supporting line
    f_sub = font(REG, 30)
    for ln in wrap(d, sub, f_sub, W - pad * 2)[:2]:
        y += 12
        d.text((pad, y), ln, font=f_sub, fill=MUTED)
        y += 40

    # footer
    d.line([(pad, H - 108), (W - pad, H - 108)], fill=RULE, width=2)
    f_foot = font(REG, 26)
    d.text((pad, H - 78), "rabbihossainltd.online", font=f_foot, fill=MUTED)
    label = "BDT pricing · Order tracking · Support"
    d.text((W - pad - d.textlength(label, font=f_foot), H - 78),
           label, font=f_foot, fill=MUTED)

    path = OUT / f"{slug}.png"
    img.save(path, "PNG", optimize=True)
    return path


if __name__ == "__main__":
    for slug, (h, s) in CARDS.items():
        p = build(slug, h, s)
        print(f"  {p.relative_to(ROOT)}  {p.stat().st_size // 1024} KB")
    print(f"\n{len(CARDS)} cards written")
