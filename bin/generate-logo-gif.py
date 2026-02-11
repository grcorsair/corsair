"""
Generate Corsair pixel-art logo GIF — Pixelify Sans Bold "corsair".

Animation: Letters type in with gold glow → hold → gold pulse sweep → loop
Transparent background for clean rendering on any theme.

Usage: python3 bin/generate-logo-gif.py
Output: assets/corsair-logo.gif
"""

from PIL import Image, ImageDraw, ImageFont
import os

# =============================================================================
# PALETTE — grcorsair.com brand
# =============================================================================

PARCHMENT = (0xE2, 0xDF, 0xD6)  # #E2DFD6 corsair-text
GOLD_HI   = (0xF5, 0xC5, 0x42)  # #F5C542 bright gold (glow highlight)

# =============================================================================
# FONT
# =============================================================================

FONT_PATH = "/tmp/PixelifySans-Bold.ttf"
MAIN_TEXT  = "corsair"
MAIN_SIZE  = 120
PAD_X = 16
PAD_Y = 10

# =============================================================================
# LAYOUT
# =============================================================================

def compute_layout(main_font):
    bbox = main_font.getbbox(MAIN_TEXT)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    width = text_w + PAD_X * 2
    height = text_h + PAD_Y * 2 + 20  # extra for descenders
    text_x = PAD_X
    text_y = PAD_Y
    return {"width": width, "height": height, "text_x": text_x, "text_y": text_y}

# =============================================================================
# RENDERING
# =============================================================================

def render_frame(layout, main_font, visible_letters=7, glow_letter=-1):
    img = Image.new("RGBA", (layout["width"], layout["height"]), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    x = layout["text_x"]
    for i, ch in enumerate(MAIN_TEXT):
        if i >= visible_letters:
            break
        color = GOLD_HI if i == glow_letter else PARCHMENT
        draw.text((x, layout["text_y"]), ch, font=main_font, fill=color)
        bbox = main_font.getbbox(ch)
        x += (bbox[2] - bbox[0]) + 2

    return img

# =============================================================================
# ANIMATION
# =============================================================================

def generate_frames(layout, main_font):
    frames = []
    durations = []

    def add(f, d_cs):
        frames.append(f)
        durations.append(d_cs * 10)

    # Phase 1: Letters type in with gold glow
    for i in range(1, len(MAIN_TEXT) + 1):
        add(render_frame(layout, main_font, visible_letters=i, glow_letter=i - 1), 10)

    # Phase 2: All settled — main hold
    add(render_frame(layout, main_font, visible_letters=len(MAIN_TEXT)), 350)

    # Phase 3: Gold pulse sweep across text
    for i in range(len(MAIN_TEXT)):
        add(render_frame(layout, main_font, visible_letters=len(MAIN_TEXT), glow_letter=i), 5)

    # Phase 4: Final hold before loop
    add(render_frame(layout, main_font, visible_letters=len(MAIN_TEXT)), 250)

    return frames, durations

# =============================================================================
# MAIN
# =============================================================================

def main():
    print("Generating Corsair logo GIF...")

    if not os.path.exists(FONT_PATH):
        print(f"ERROR: Font not found at {FONT_PATH}")
        print("Run: curl -sL 'https://fonts.gstatic.com/s/pixelifysans/v3/"
              "CHy2V-3HFUT7aC4iv1TxGDR9DHEserHN25py2TQO131Y.ttf' "
              "-o /tmp/PixelifySans-Bold.ttf")
        return

    main_font = ImageFont.truetype(FONT_PATH, MAIN_SIZE)
    layout = compute_layout(main_font)

    print(f"  Canvas: {layout['width']}x{layout['height']}")

    frames, durations = generate_frames(layout, main_font)
    print(f"  Frames: {len(frames)}")

    # Convert RGBA → palette with transparency
    p_frames = []
    for frame in frames:
        alpha = frame.split()[3]
        p = frame.convert("RGB").convert("P", palette=Image.ADAPTIVE, colors=255)
        mask = alpha.point(lambda a: 255 if a <= 128 else 0)
        p.paste(255, mask)
        p_frames.append(p)

    output_path = "assets/corsair-logo.gif"
    p_frames[0].save(
        output_path,
        save_all=True,
        append_images=p_frames[1:],
        duration=durations,
        loop=0,
        optimize=False,
        transparency=255,
        disposal=2,
    )

    size_kb = os.path.getsize(output_path) / 1024
    print(f"  Size: {size_kb:.1f} KB")
    print(f"  Written to: {output_path}")
    print("Done!")


if __name__ == "__main__":
    main()
