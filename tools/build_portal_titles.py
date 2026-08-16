from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "images" / "portal" / "source"
PUBLIC = ROOT / "images" / "portal"
FONT_PATH = Path(r"C:\Windows\Fonts\BIZ-UDGothicB.ttc")

CABINETS = {
    "hell-runner": "cabinet-hell-runner-final2.png",
    "boss-2048": "cabinet-boss-2048-final2.png",
    "coming-soon": "cabinet-coming-soon-final2.png",
}

TITLES = {
    "hell-runner": ("HELL RUNNER", (255, 61, 38)),
    "boss-2048": ("討伐2048", (151, 87, 255)),
    "coming-soon": ("COMING SOON", (111, 216, 255)),
}


def font_for_height(text: str, target_height: int) -> ImageFont.FreeTypeFont:
    size = target_height
    while True:
        font = ImageFont.truetype(str(FONT_PATH), size=size, index=0)
        box = font.getbbox(text, stroke_width=0)
        height = box[3] - box[1]
        if height >= target_height:
            return font
        size += 1


def make_title(text: str, glow: tuple[int, int, int]) -> Image.Image:
    canvas = Image.new("RGBA", (1024, 192), (0, 0, 0, 0))
    font = font_for_height(text, 92)
    box = font.getbbox(text, stroke_width=2)
    width = box[2] - box[0]
    height = box[3] - box[1]
    x = (canvas.width - width) // 2 - box[0]
    y = (canvas.height - height) // 2 - box[1]

    mask = Image.new("L", canvas.size, 0)
    draw_mask = ImageDraw.Draw(mask)
    draw_mask.text((x, y), text, font=font, fill=255, stroke_width=2, stroke_fill=255)

    wide_glow = Image.new("RGBA", canvas.size, (*glow, 0))
    wide_glow.putalpha(mask.filter(ImageFilter.GaussianBlur(18)).point(lambda a: int(a * 0.65)))
    tight_glow = Image.new("RGBA", canvas.size, (*glow, 0))
    tight_glow.putalpha(mask.filter(ImageFilter.GaussianBlur(6)).point(lambda a: int(a * 0.9)))
    canvas = Image.alpha_composite(canvas, wide_glow)
    canvas = Image.alpha_composite(canvas, tight_glow)

    draw = ImageDraw.Draw(canvas)
    draw.text((x, y), text, font=font, fill=(250, 248, 244, 255), stroke_width=2, stroke_fill=(*glow, 255))
    return canvas


def main() -> None:
    master = Image.open(SOURCE / "cabinet-master-new-alpha.png").convert("RGBA")
    marquee_bottom = 205

    for key, source_name in CABINETS.items():
        cabinet = Image.open(SOURCE / source_name).convert("RGBA")
        # 同じ共通マスターの空看板へ戻し、タイトルの位置調整を筐体再生成から切り離す。
        cabinet.paste(master.crop((0, 0, master.width, marquee_bottom)), (0, 0))
        source_out = SOURCE / f"cabinet-{key}-final3.png"
        cabinet.save(source_out)
        cabinet.resize((1200, 1680), Image.Resampling.LANCZOS).save(
            PUBLIC / f"cabinet-{key}.webp", "WEBP", quality=92, method=6
        )

    for key, (text, glow) in TITLES.items():
        title = make_title(text, glow)
        title.save(SOURCE / f"title-{key}.png")
        title.save(PUBLIC / f"title-{key}.webp", "WEBP", lossless=True, method=6)

        alpha = title.getchannel("A")
        corners = [alpha.getpixel(point) for point in ((0, 0), (1023, 0), (0, 191), (1023, 191))]
        transparent = alpha.histogram()[0]
        if corners != [0, 0, 0, 0] or transparent == 0:
            raise RuntimeError(f"{key}: transparent title validation failed")
        print(f"{key}: size={title.size}, corners={corners}, alpha0={transparent}")


if __name__ == "__main__":
    main()
