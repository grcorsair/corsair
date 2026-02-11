"""
Generate Corsair pixel-art logo GIF using the actual Pixelify Sans Bold font.
Matches the grcorsair.com hero section exactly.

Usage: python3 bin/generate-logo-gif.py
Output: assets/corsair-logo.gif
"""

from PIL import Image, ImageDraw, ImageFont
import os

# =============================================================================
# CONFIG — matches grcorsair.com brand identity
# =============================================================================

BG_COLOR = (0x0A, 0x0E, 0x17)         # #0A0E17 dark ocean
TEXT_COLOR = (0xE2, 0xDF, 0xD6)        # #E2DFD6 parchment (corsair-text)
GOLD_COLOR = (0xD4, 0xA8, 0x53)       # #D4A853 gold
DIM_COLOR = (0x8B, 0x92, 0xA8)        # #8B92A8 dim text
GREEN_COLOR = (0x2E, 0xCC, 0x71)      # #2ECC71 green (glow accent)

FONT_PATH = "/tmp/PixelifySans-Bold.ttf"
MAIN_TEXT = "corsair"
SUB_TEXT = "Compliance trust exchange protocol."
ACCENT_TEXT = "Verify proof. Not promises."

# Sizing
MAIN_SIZE = 140                        # Main "corsair" font size (big, like website hero)
SUB_SIZE = 22                          # Subtitle font size
ACCENT_SIZE = 22                       # Accent line font size
WIDTH = 620
HEIGHT = 240
PADDING_TOP = 12
LINE_GAP = 30
ACCENT_GAP = 6

# Animation
TYPING_DELAY = 12                      # centiseconds per letter appear
SETTLE_DELAY = 8                       # brief pause after typing
SUB_APPEAR_DELAY = 15                  # subtitle fade in
HOLD_DELAY = 350                       # main hold (3.5s)
SWEEP_DELAY = 6                        # cyan sweep per letter
FINAL_HOLD = 250                       # hold before loop (2.5s)

# =============================================================================
# FONT LOADING
# =============================================================================

def load_fonts():
    """Load Pixelify Sans Bold for main text, fallback for subtitle."""
    main_font = ImageFont.truetype(FONT_PATH, MAIN_SIZE)
    # For subtitle, use a clean sans-serif at small size
    try:
        sub_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", SUB_SIZE)
        accent_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", ACCENT_SIZE)
    except Exception:
        sub_font = ImageFont.load_default()
        accent_font = ImageFont.load_default()
    return main_font, sub_font, accent_font

# =============================================================================
# FRAME RENDERING
# =============================================================================

def render_frame(main_font, sub_font, accent_font,
                 visible_letters=7, glow_letter=-1,
                 show_sub=False, show_accent=False):
    """Render a single frame."""
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)

    # Calculate main text position (left-aligned with padding)
    pad_left = 30

    # Render main "corsair" letters
    x_cursor = pad_left
    for i, ch in enumerate(MAIN_TEXT):
        if i >= visible_letters:
            break

        # Determine color
        if i == glow_letter:
            color = GREEN_COLOR
        else:
            color = TEXT_COLOR

        # Draw character
        draw.text((x_cursor, PADDING_TOP), ch, font=main_font, fill=color)

        # Advance cursor - measure this character's width
        bbox = main_font.getbbox(ch)
        char_width = bbox[2] - bbox[0]
        # Pixelify Sans has tight spacing, add a small kern
        x_cursor += char_width + 2

    # Position subtitle below main text
    # Use fixed offset from top since getbbox underreports pixel font descenders
    sub_y = PADDING_TOP + 130  # Pixelify Sans Bold 140pt renders ~120px + padding

    # Render subtitle
    if show_sub:
        draw.text((pad_left, sub_y), SUB_TEXT, font=sub_font, fill=DIM_COLOR)

    # Render accent line
    if show_accent:
        accent_y = sub_y + SUB_SIZE + ACCENT_GAP
        draw.text((pad_left, accent_y), ACCENT_TEXT, font=accent_font, fill=GOLD_COLOR)

    return img

# =============================================================================
# ANIMATION SEQUENCE
# =============================================================================

def generate_frames(main_font, sub_font, accent_font):
    """Generate all animation frames."""
    frames = []
    durations = []

    # Phase 1: Letters type in one by one
    for i in range(1, len(MAIN_TEXT) + 1):
        frame = render_frame(main_font, sub_font, accent_font,
                           visible_letters=i, glow_letter=i-1)
        frames.append(frame)
        durations.append(TYPING_DELAY * 10)  # Pillow uses milliseconds

    # Phase 2: All letters settle (glow off)
    frame = render_frame(main_font, sub_font, accent_font,
                        visible_letters=len(MAIN_TEXT))
    frames.append(frame)
    durations.append(SETTLE_DELAY * 10)

    # Phase 3: Subtitle appears
    frame = render_frame(main_font, sub_font, accent_font,
                        visible_letters=len(MAIN_TEXT), show_sub=True)
    frames.append(frame)
    durations.append(SUB_APPEAR_DELAY * 10)

    # Phase 4: Accent line appears
    frame = render_frame(main_font, sub_font, accent_font,
                        visible_letters=len(MAIN_TEXT),
                        show_sub=True, show_accent=True)
    frames.append(frame)
    durations.append(HOLD_DELAY * 10)

    # Phase 5: Cyan sweep across letters
    for i in range(len(MAIN_TEXT)):
        frame = render_frame(main_font, sub_font, accent_font,
                           visible_letters=len(MAIN_TEXT), glow_letter=i,
                           show_sub=True, show_accent=True)
        frames.append(frame)
        durations.append(SWEEP_DELAY * 10)

    # Phase 6: Final hold
    frame = render_frame(main_font, sub_font, accent_font,
                        visible_letters=len(MAIN_TEXT),
                        show_sub=True, show_accent=True)
    frames.append(frame)
    durations.append(FINAL_HOLD * 10)

    return frames, durations

# =============================================================================
# MAIN
# =============================================================================

def main():
    print("Generating Corsair logo GIF (Pixelify Sans Bold)...")

    if not os.path.exists(FONT_PATH):
        print(f"ERROR: Font not found at {FONT_PATH}")
        print("Run: curl -sL 'https://fonts.gstatic.com/s/pixelifysans/v3/CHy2V-3HFUT7aC4iv1TxGDR9DHEserHN25py2TQO131Y.ttf' -o /tmp/PixelifySans-Bold.ttf")
        return

    main_font, sub_font, accent_font = load_fonts()
    frames, durations = generate_frames(main_font, sub_font, accent_font)

    print(f"  Dimensions: {WIDTH}x{HEIGHT}")
    print(f"  Frames: {len(frames)}")

    # Save as animated GIF
    output_path = "assets/corsair-logo.gif"
    frames[0].save(
        output_path,
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,  # Loop forever
        optimize=True,
    )

    size_kb = os.path.getsize(output_path) / 1024
    print(f"  Size: {size_kb:.1f} KB")
    print(f"  Written to: {output_path}")
    print("Done!")

if __name__ == "__main__":
    main()
