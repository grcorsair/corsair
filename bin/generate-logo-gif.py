"""
Generate Corsair pixel-art logo GIF — Pixelify Sans Bold + Jolly Roger flag.

Layout: [Pirate Flag] corsair
Animation: Flag gold shine sweep → text types in with gold glow → hold → pulse loop

Usage: python3 bin/generate-logo-gif.py
Output: assets/corsair-logo.gif
"""

from PIL import Image, ImageDraw, ImageFont
import os

# =============================================================================
# PALETTE — grcorsair.com brand
# =============================================================================

BG        = (0x0A, 0x0E, 0x17)  # #0A0E17 dark ocean
PARCHMENT = (0xE2, 0xDF, 0xD6)  # #E2DFD6 corsair-text
GOLD      = (0xD4, 0xA8, 0x53)  # #D4A853 gold
GOLD_HI   = (0xF5, 0xC5, 0x42)  # #F5C542 bright gold (shine highlight)
GOLD_DIM  = (0x8A, 0x6E, 0x35)  # dim gold
FLAG_BG   = (0x12, 0x16, 0x22)  # near-black flag field
SURFACE   = (0x11, 0x18, 0x33)  # #111833 surface

# =============================================================================
# FONT
# =============================================================================

FONT_PATH = "/tmp/PixelifySans-Bold.ttf"
MAIN_TEXT  = "corsair"
MAIN_SIZE  = 120

# =============================================================================
# SKULL & CROSSBONES — 18x18 pixel grid
# Gold (#D4A853) on dark flag field
# =============================================================================

_ = None  # transparent (use flag background)
G = "gold"
H = "gold_hi"  # highlight for shine

SKULL_GRID = [
    [_,_,_,_,_,_,G,G,G,G,G,G,_,_,_,_,_,_],
    [_,_,_,_,_,G,G,G,G,G,G,G,G,_,_,_,_,_],
    [_,_,_,_,G,G,G,G,G,G,G,G,G,G,_,_,_,_],
    [_,_,_,_,G,G,G,G,G,G,G,G,G,G,_,_,_,_],
    [_,_,_,_,G,G,_,_,G,G,_,_,G,G,_,_,_,_],
    [_,_,_,_,G,G,_,_,G,G,_,_,G,G,_,_,_,_],
    [_,_,_,_,_,G,G,G,_,_,G,G,G,_,_,_,_,_],
    [_,_,_,_,_,_,G,G,G,G,G,G,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,G,G,G,G,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,G,_,G,G,_,G,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,G,G,G,G,_,_,_,_,_,_,_],
    [_,G,_,_,_,_,_,_,G,G,_,_,_,_,_,_,G,_],
    [_,_,G,G,_,_,_,_,_,_,_,_,_,_,G,G,_,_],
    [_,_,_,G,G,G,_,_,_,_,_,_,G,G,G,_,_,_],
    [_,_,_,_,_,G,G,G,G,G,G,G,G,_,_,_,_,_],
    [_,_,_,G,G,G,_,_,_,_,_,_,G,G,G,_,_,_],
    [_,_,G,G,_,_,_,_,_,_,_,_,_,_,G,G,_,_],
    [_,G,_,_,_,_,_,_,_,_,_,_,_,_,_,_,G,_],
]

SKULL_SIZE = 18  # grid dimensions
SKULL_PX   = 5   # each grid cell = 5x5 real pixels → 90x90 skull

# =============================================================================
# LAYOUT
# =============================================================================

FLAG_W = SKULL_SIZE * SKULL_PX + 20     # skull + padding
FLAG_H = SKULL_SIZE * SKULL_PX + 20
GAP = 24                                 # gap between flag and text

def compute_layout(main_font):
    """Compute canvas dimensions and element positions."""
    bbox = main_font.getbbox(MAIN_TEXT)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    total_w = FLAG_W + GAP + text_w + 40  # padding
    total_h = max(FLAG_H, text_h + 20) + 30

    # Center vertically
    flag_x = 20
    flag_y = (total_h - FLAG_H) // 2
    text_x = flag_x + FLAG_W + GAP
    text_y = (total_h - text_h) // 2 - 10  # slight upward for optical center

    return {
        "width": total_w,
        "height": total_h,
        "flag_x": flag_x,
        "flag_y": flag_y,
        "text_x": text_x,
        "text_y": text_y,
    }

# =============================================================================
# RENDERING
# =============================================================================

def draw_flag(draw, fx, fy, shine_col=-1):
    """Draw the pirate flag with skull & crossbones.
    shine_col: column index for the gold shine sweep (-1 = no shine)."""

    # Flag background (rounded rect feel via filled rectangle)
    draw.rectangle(
        [fx, fy, fx + FLAG_W - 1, fy + FLAG_H - 1],
        fill=FLAG_BG,
        outline=GOLD_DIM,
        width=2,
    )

    # Skull & crossbones
    skull_ox = fx + (FLAG_W - SKULL_SIZE * SKULL_PX) // 2
    skull_oy = fy + (FLAG_H - SKULL_SIZE * SKULL_PX) // 2

    for row in range(SKULL_SIZE):
        for col in range(SKULL_SIZE):
            cell = SKULL_GRID[row][col]
            if cell is None:
                continue

            # Determine color — shine sweep makes a vertical band bright
            if shine_col >= 0 and abs(col - shine_col) <= 1:
                color = GOLD_HI
            else:
                color = GOLD

            px = skull_ox + col * SKULL_PX
            py = skull_oy + row * SKULL_PX
            draw.rectangle([px, py, px + SKULL_PX - 1, py + SKULL_PX - 1], fill=color)


def render_frame(layout, main_font, visible_letters=7, glow_letter=-1,
                 show_flag=True, flag_shine_col=-1):
    """Render a single animation frame."""
    img = Image.new("RGBA", (layout["width"], layout["height"]), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Draw pirate flag
    if show_flag:
        draw_flag(draw, layout["flag_x"], layout["flag_y"], flag_shine_col)

    # Draw "corsair" text
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
    """Build the full animation sequence."""
    frames = []
    durations = []

    def add(f, d_cs):
        frames.append(f)
        durations.append(d_cs * 10)  # centiseconds → milliseconds

    # Phase 1: Flag appears with shine sweep (18 columns)
    for col in range(0, SKULL_SIZE, 2):
        add(render_frame(layout, main_font, visible_letters=0,
                        flag_shine_col=col), 4)

    # Phase 2: Flag settled, brief pause
    add(render_frame(layout, main_font, visible_letters=0), 15)

    # Phase 3: Text types in with gold glow
    for i in range(1, len(MAIN_TEXT) + 1):
        add(render_frame(layout, main_font, visible_letters=i,
                        glow_letter=i-1), 10)

    # Phase 4: All settled — main hold
    add(render_frame(layout, main_font, visible_letters=len(MAIN_TEXT)), 350)

    # Phase 5: Gold pulse sweep across text
    for i in range(len(MAIN_TEXT)):
        add(render_frame(layout, main_font, visible_letters=len(MAIN_TEXT),
                        glow_letter=i), 5)

    # Phase 6: Gold shine sweeps flag again
    for col in range(0, SKULL_SIZE, 2):
        add(render_frame(layout, main_font, visible_letters=len(MAIN_TEXT),
                        flag_shine_col=col), 4)

    # Phase 7: Final hold before loop
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

    # Convert RGBA frames to P (palette) mode with transparency
    p_frames = []
    for frame in frames:
        alpha = frame.split()[3]
        p = frame.convert("RGB").convert("P", palette=Image.ADAPTIVE, colors=255)
        # Build transparency mask: index 255 where alpha is transparent
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
        disposal=2,  # restore to background (transparent) between frames
    )

    size_kb = os.path.getsize(output_path) / 1024
    print(f"  Size: {size_kb:.1f} KB")
    print(f"  Written to: {output_path}")
    print("Done!")


if __name__ == "__main__":
    main()
