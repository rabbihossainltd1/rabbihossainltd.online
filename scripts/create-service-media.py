from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "images" / "service-cards"
OUT.mkdir(parents=True, exist_ok=True)
W, H = 1200, 750
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# Each banner is rebuilt from structured content. No original poster is cropped,
# resized, embedded or used as an inset image.
LOGO_ROOT = ROOT / "images" / "brand-logos"

LOGOS = {
    "visa-mastercard": ["visa.png", "mastercard.png"],
    "meta-verified": ["meta.png"],
    "chatgpt": ["chatgpt.png"],
    "gemini": ["google-gemini.png"],
    "canva": ["canva.png"],
    "capcut": ["capcut.png"],
    "youtube": ["youtube.png"],
    "truecaller": ["truecaller.png"],
    "imo": ["imo.webp"],
    "netflix": ["netflix.png"],
    "grok": ["x.png"],
    "premiere-pro": ["adobe-premiere-pro.png"],
    "photoshop": ["adobe-photoshop.png"],
    "illustrator": ["adobe-illustrator.png"],
    "windows": ["windows.png"],
    "excel": ["microsoft-excel.png"],
    "free-fire-topup": ["free-fire.png"],
    "ff-drip": ["free-fire.png", "android.png"],
    "ff-h4x": ["free-fire.png", "android.png"],
    "ff-ios": ["free-fire.png", "apple.png"],
    "ff-pc": ["free-fire.png", "windows.png"],
    "br-mods": ["free-fire.png", "android.png"],
    "ethical-hacking": ["kali-linux.png"],
    "android-development": ["android.png"],
    "web-development": ["html5.png", "javascript.png"],
    "premium-services": ["chatgpt.png", "youtube.png", "netflix.png", "canva.png"],
}

SERVICES = [
    dict(slug="visa-mastercard", title="Visa & Mastercard", category="CARD SERVICE", mark="VISA", icon="card", color=(52,104,220), features=["Physical or virtual card", "Online payment support", "Fixed package options"]),
    dict(slug="meta-verified", title="Meta Verified", category="VERIFICATION", mark="META", icon="infinity", color=(36,127,226), features=["Profile and page support", "Application guidance", "Order status updates"]),
    dict(slug="chatgpt", title="ChatGPT", category="AI SUBSCRIPTION", mark="AI", icon="chat", color=(22,166,118), features=["Go, Plus and Pro", "Advanced AI tools", "Monthly plan options"]),
    dict(slug="gemini", title="Gemini AI", category="AI SUBSCRIPTION", mark="G", icon="spark", color=(106,85,232), features=["AI Pro and AI Ultra", "Advanced model access", "Monthly plans"]),
    dict(slug="canva", title="Canva Pro", category="DESIGN TOOL", mark="C", icon="design", color=(103,74,238), features=["Pro and Teams plans", "Premium templates", "Cloud design tools"]),
    dict(slug="capcut", title="CapCut Pro", category="VIDEO EDITING", mark="CC", icon="cut", color=(226,55,100), features=["Premium editing tools", "No-watermark workflow", "Monthly or yearly"]),
    dict(slug="youtube", title="YouTube Premium", category="STREAMING", mark="YT", icon="play", color=(226,40,53), features=["Ad-free viewing", "Background playback", "Multiple plan options"]),
    dict(slug="truecaller", title="Truecaller Premium", category="COMMUNICATION", mark="TC", icon="phone", color=(38,116,229), features=["Caller identification", "Spam call blocking", "Premium and Gold"]),
    dict(slug="imo", title="imo Premium", category="COMMUNICATION", mark="imo", icon="message", color=(42,132,235), features=["Premium account badge", "Calling features", "Flexible durations"]),
    dict(slug="netflix", title="Netflix", category="STREAMING", mark="N", icon="screen", color=(215,33,47), features=["Mobile to Premium", "Monthly access", "Plan selection"]),
    dict(slug="grok", title="Grok AI", category="AI ASSISTANT", mark="X", icon="orbit", color=(185,185,185), features=["Basic to Premium", "AI assistant access", "Monthly and yearly"]),
    dict(slug="vpn", title="Premium VPN", category="PRIVACY", mark="VPN", icon="shield", color=(27,181,108), features=["Private browsing", "1 to 10 devices", "One-year plans"]),
    dict(slug="antivirus", title="Antivirus", category="SECURITY", mark="AV", icon="shield", color=(34,177,151), features=["Malware protection", "Multi-device options", "One-year plans"]),
    dict(slug="remove-ads", title="Remove Ads", category="UTILITY", mark="AD", icon="block", color=(219,52,124), features=["Mobile ad removal", "Cleaner app experience", "Lifetime option"]),
    dict(slug="premiere-pro", title="Adobe Premiere Pro", category="CREATIVE SOFTWARE", mark="Pr", icon="timeline", color=(144,77,222), features=["Professional video editing", "Creative workflow tools", "Monthly or annual"]),
    dict(slug="photoshop", title="Adobe Photoshop", category="CREATIVE SOFTWARE", mark="Ps", icon="layers", color=(42,125,225), features=["Photo editing tools", "Creative workflow", "Monthly or annual"]),
    dict(slug="illustrator", title="Adobe Illustrator", category="CREATIVE SOFTWARE", mark="Ai", icon="pen", color=(232,112,30), features=["Vector design tools", "Creative workflow", "Monthly or annual"]),
    dict(slug="windows", title="Windows License Key", category="PC SOFTWARE", mark="WIN", icon="windows", color=(37,126,222), features=["Windows 10 or 11", "Home and Pro options", "Lifetime activation"]),
    dict(slug="excel", title="Microsoft Excel", category="PC SOFTWARE", mark="X", icon="grid", color=(24,147,84), features=["Excel and Microsoft 365", "Single or family plans", "Multiple license options"]),
    dict(slug="free-fire-topup", title="Free Fire Top-up", category="GAMING", mark="FF", icon="diamond", color=(233,139,34), features=["Diamond packages", "Weekly or monthly", "UID-based delivery"]),
    dict(slug="ff-drip", title="Android Panel Drip", category="GAMING PANEL", mark="DRIP", icon="android", color=(142,70,218), features=["Android client access", "Multiple durations", "Root-device option"]),
    dict(slug="ff-h4x", title="Android Panel FFH4X", category="GAMING PANEL", mark="H4X", icon="game", color=(224,74,40), features=["Android panel access", "Multiple durations", "Package selection"]),
    dict(slug="ff-ios", title="Free Fire iPhone Panel", category="GAMING PANEL", mark="iOS", icon="apple", color=(36,142,226), features=["iPhone panel access", "1, 7 or 31 days", "Full setup option"]),
    dict(slug="ff-pc", title="Free Fire PC Panel", category="GAMING PANEL", mark="PC", icon="monitor", color=(203,52,56), features=["Desktop panel access", "1 day to 1 year", "Package selection"]),
    dict(slug="br-mods", title="BR Mods", category="GAMING PANEL", mark="BR", icon="game", color=(28,169,184), features=["Android panel access", "Multiple durations", "Setup support"]),
    dict(slug="ethical-hacking", title="Ethical Hacking", category="SECURITY SERVICE", mark="SEC", icon="lock", color=(205,59,70), features=["Security review", "Vulnerability testing", "Findings report"]),
    dict(slug="android-development", title="Android Development", category="DEVELOPMENT", mark="APK", icon="android", color=(57,179,92), features=["Application interface", "API integration", "Release support"]),
    dict(slug="web-development", title="Website Development", category="DEVELOPMENT", mark="WEB", icon="code", color=(47,124,221), features=["Responsive interface", "Custom functionality", "Performance-focused build"]),
    dict(slug="digital-branding", title="Digital Branding", category="CREATIVE SERVICE", mark="BRAND", icon="megaphone", color=(228,130,38), features=["Visual identity", "Social media assets", "Campaign materials"]),
    dict(slug="premium-services", title="Premium Digital Services", category="DIGITAL SERVICE", mark="PRO", icon="apps", color=(190,62,202), features=["Apps and software", "Plan selection", "Delivery support"]),
]


def font(path, size):
    return ImageFont.truetype(path, size)


def mix(a, b, t):
    return tuple(round(a[i] * (1 - t) + b[i] * t) for i in range(3))


def gradient(color):
    img = Image.new("RGB", (W, H), (7, 7, 8))
    px = img.load()
    for y in range(H):
        for x in range(W):
            r = ((x - W * .80) ** 2 + (y - H * .35) ** 2) ** .5 / 900
            glow = max(0, 1 - r)
            side = x / W
            amount = .05 + glow * .42 + side * .11
            px[x, y] = mix((7, 7, 8), color, amount)
    return img


def rounded_panel(base, box, radius, fill, outline=None, width=1):
    d = ImageDraw.Draw(base)
    d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_icon(d, icon, box, color, mark):
    x1, y1, x2, y2 = box
    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
    w, h = x2 - x1, y2 - y1
    white = (246, 246, 243)
    stroke = 8
    if icon == "play":
        d.rounded_rectangle(box, radius=36, outline=color, width=stroke)
        d.polygon([(cx-30,cy-48),(cx-30,cy+48),(cx+54,cy)], fill=white)
    elif icon == "infinity":
        d.ellipse((x1+24,cy-58,cx+22,cy+58), outline=color, width=stroke)
        d.ellipse((cx-22,cy-58,x2-24,cy+58), outline=color, width=stroke)
    elif icon in ("screen", "monitor"):
        d.rounded_rectangle((x1+18,y1+25,x2-18,y2-45), radius=22, outline=color, width=stroke)
        d.line((cx, y2-45, cx, y2-12), fill=color, width=stroke)
        d.line((cx-52,y2-12,cx+52,y2-12), fill=color, width=stroke)
    elif icon == "card":
        d.rounded_rectangle((x1+8,y1+45,x2-8,y2-45), radius=28, outline=white, width=stroke)
        d.line((x1+8,y1+105,x2-8,y1+105), fill=color, width=14)
        d.ellipse((x2-108,cy-26,x2-56,cy+26), fill=(227,35,51))
        d.ellipse((x2-78,cy-26,x2-26,cy+26), fill=(244,153,28))
    elif icon in ("shield", "lock"):
        pts=[(cx,y1+18),(x2-28,y1+65),(x2-54,y2-62),(cx,y2-16),(x1+54,y2-62),(x1+28,y1+65)]
        d.polygon(pts, outline=color)
        d.line(pts+[pts[0]], fill=color, width=stroke, joint="curve")
        if icon=="lock": d.rounded_rectangle((cx-35,cy-5,cx+35,cy+58),radius=12,outline=white,width=7)
    elif icon == "diamond":
        pts=[(cx,y1+16),(x2-25,cy-30),(cx,y2-10),(x1+25,cy-30)]
        d.polygon(pts, outline=color);d.line(pts+[pts[0]],fill=color,width=stroke)
        d.line((x1+25,cy-30,x2-25,cy-30),fill=color,width=stroke)
    elif icon == "windows":
        gap=10;d.rectangle((x1+30,y1+30,cx-gap,cy-gap),fill=color);d.rectangle((cx+gap,y1+30,x2-30,cy-gap),fill=color);d.rectangle((x1+30,cy+gap,cx-gap,y2-30),fill=color);d.rectangle((cx+gap,cy+gap,x2-30,y2-30),fill=color)
    elif icon == "grid":
        d.rounded_rectangle((x1+25,y1+22,x2-25,y2-22),radius=20,outline=color,width=stroke)
        for i in range(1,4):d.line((x1+25+i*w/4,y1+22,x1+25+i*w/4,y2-22),fill=color,width=4)
        for i in range(1,4):d.line((x1+25,y1+22+i*h/4,x2-25,y1+22+i*h/4),fill=color,width=4)
    elif icon == "code":
        d.line((cx-25,y1+35,x1+30,cy,x1+30,cy,cx-25,y2-35),fill=color,width=stroke)
        d.line((cx+25,y1+35,x2-30,cy,x2-30,cy,cx+25,y2-35),fill=color,width=stroke)
        d.line((cx+18,y1+24,cx-18,y2-24),fill=white,width=7)
    elif icon == "phone":
        d.rounded_rectangle((cx-65,y1+10,cx+65,y2-10),radius=28,outline=color,width=stroke)
        d.ellipse((cx-9,y2-43,cx+9,y2-25),fill=white)
    elif icon == "message":
        d.rounded_rectangle((x1+22,y1+36,x2-22,y2-62),radius=30,outline=color,width=stroke)
        d.polygon([(cx-40,y2-62),(cx-68,y2-18),(cx+4,y2-62)],fill=color)
    elif icon == "block":
        d.ellipse((x1+24,y1+24,x2-24,y2-24),outline=color,width=stroke)
        d.line((x1+62,y2-62,x2-62,y1+62),fill=color,width=stroke+5)
    elif icon == "layers":
        for off in (0,30,60):d.rounded_rectangle((x1+35+off/2,y1+35+off/2,x2-35-off/2,y2-75+off/2),radius=22,outline=color,width=6)
    elif icon == "timeline":
        for yy in (cy-60,cy,cy+60):d.rounded_rectangle((x1+25,yy-14,x2-25,yy+14),radius=8,fill=color)
        d.rectangle((cx-35,y1+22,cx+35,y2-22),outline=white,width=6)
    elif icon == "spark":
        pts=[(cx,y1+8),(cx+25,cy-25),(x2-8,cy),(cx+25,cy+25),(cx,y2-8),(cx-25,cy+25),(x1+8,cy),(cx-25,cy-25)]
        d.polygon(pts,fill=color)
    else:
        d.rounded_rectangle((x1+24,y1+24,x2-24,y2-24),radius=34,outline=color,width=stroke)
        d.text((cx,cy),mark,font=font(BOLD,42 if len(mark)>2 else 62),fill=white,anchor="mm")


def wrap_title(draw, title, max_width):
    f=font(BOLD,64 if len(title)<20 else 56)
    words=title.split();lines=[];line=""
    for word in words:
        test=(line+" "+word).strip()
        if draw.textbbox((0,0),test,font=f)[2]<=max_width or not line:line=test
        else:lines.append(line);line=word
    if line:lines.append(line)
    return f,lines[:3]


def load_logo(name):
    logo = Image.open(LOGO_ROOT / name).convert("RGBA")

    # The downloaded Free Fire wordmark came on a flat #282828 background.
    # Remove only that neutral background while preserving the white/yellow
    # official wordmark, then place it on a purpose-built dark logo tile.
    if name == "free-fire.png":
        px = logo.load()
        for y in range(logo.height):
            for x in range(logo.width):
                r, g, b, a = px[x, y]
                if abs(r-g) < 8 and abs(g-b) < 8 and r < 80:
                    px[x, y] = (r, g, b, 0)

    alpha = logo.getchannel("A")
    bbox = alpha.getbbox()
    return logo.crop(bbox) if bbox else logo


def paste_contained(base, logo, box):
    x1, y1, x2, y2 = box
    max_w, max_h = x2 - x1, y2 - y1
    logo = logo.copy()
    logo.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
    x = x1 + (max_w - logo.width) // 2
    y = y1 + (max_h - logo.height) // 2
    base.alpha_composite(logo, (x, y))


def paste_logo_tile(layer, name, box, accent):
    x1, y1, x2, y2 = box
    d = ImageDraw.Draw(layer)
    is_free_fire = name == "free-fire.png"
    fill = (24, 24, 26, 255) if is_free_fire else (246, 246, 244, 255)
    radius = max(34, round((x2 - x1) * .25))

    # Soft rounded-square badge; no hard square frame.
    d.rounded_rectangle(box, radius=radius, fill=fill, outline=(*mix(accent, (255,255,255), .45), 255), width=3)
    inset = max(18, round((x2 - x1) * .14))
    paste_contained(layer, load_logo(name), (x1+inset, y1+inset, x2-inset, y2-inset))


def draw_official_logos(img, slug, accent):
    names = LOGOS.get(slug, [])
    if not names:
        return False

    layer = img.convert("RGBA")
    if len(names) == 1:
        if names[0] == "free-fire.png":
            # The Free Fire mark is a wide wordmark, so give it a rounded pill
            # instead of shrinking it into a square badge.
            paste_logo_tile(layer, names[0], (715, 245, 1095, 405), accent)
        else:
            paste_logo_tile(layer, names[0], (760, 175, 1050, 465), accent)
    elif len(names) == 2:
        if names[0] == "free-fire.png":
            paste_logo_tile(layer, names[0], (700, 250, 910, 380), accent)
            paste_logo_tile(layer, names[1], (950, 235, 1090, 375), accent)
        else:
            paste_logo_tile(layer, names[0], (720, 235, 885, 400), accent)
            paste_logo_tile(layer, names[1], (925, 235, 1090, 400), accent)
    else:
        slots = [(740, 170, 875, 305), (925, 170, 1060, 305), (740, 350, 875, 485), (925, 350, 1060, 485)]
        for name, box in zip(names[:4], slots):
            paste_logo_tile(layer, name, box, accent)

    img.paste(layer.convert("RGB"))
    return True


def create(item, index):
    accent=item["color"]
    img=gradient(accent)
    d=ImageDraw.Draw(img)

    # subtle structure instead of decorative poster clutter
    for x in range(0,W,80):d.line((x,0,x,H),fill=mix((8,8,9),accent,.05),width=1)
    for y in range(0,H,80):d.line((0,y,W,y),fill=mix((8,8,9),accent,.05),width=1)

    d.ellipse((72,72,88,88),fill=accent)
    d.text((104,66),item["category"],font=font(BOLD,19),fill=(190,190,186))
    d.text((74,118),f"{index:02d}",font=font(REG,18),fill=(112,112,109))

    f,lines=wrap_title(d,item["title"],465)
    y=168
    for line in lines:
        d.text((72,y),line,font=f,fill=(248,248,245));y+=f.size*1.08
    d.rounded_rectangle((72,y+16,152,y+22),radius=3,fill=accent)

    fy=y+62
    for feature in item["features"]:
        d.ellipse((74,fy+8,84,fy+18),fill=accent)
        d.text((102,fy),feature,font=font(REG,25),fill=(185,185,181))
        fy+=48

    d.text((72,H-72),"rabbihossainltd.online",font=font(REG,17),fill=(108,108,105))

    # Use the actual product/platform logo whenever the service has one.
    # Generic services (VPN, antivirus, ad removal, branding) retain a neutral
    # service-specific vector symbol because there is no single product brand.
    rounded_panel(img,(690,120,1120,630),42,(13,13,15),mix(accent,(255,255,255),.32),3)
    if draw_official_logos(img, item["slug"], accent):
        d = ImageDraw.Draw(img)
        d.text((905,575), item["title"], font=font(BOLD,24), fill=(245,245,242), anchor="mm")
        d.text((905,607), item["category"].title(), font=font(REG,16), fill=(128,128,125), anchor="mm")
    else:
        d = ImageDraw.Draw(img)
        draw_icon(d,item["icon"],(750,188,1060,498),accent,item["mark"])
        d.text((905,555),item["mark"],font=font(BOLD,42 if len(item["mark"])>2 else 58),fill=(245,245,242),anchor="mm")
        d.text((905,605),item["category"].title(),font=font(REG,17),fill=(128,128,125),anchor="mm")

    q=img.quantize(colors=192,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.FLOYDSTEINBERG)
    q.save(OUT/f"{item['slug']}.png",optimize=True,compress_level=9)


for i,item in enumerate(SERVICES,1):create(item,i)
print(f"Created {len(SERVICES)} original service banners in {OUT}")
