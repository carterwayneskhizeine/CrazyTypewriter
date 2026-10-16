#!/usr/bin/env python3
"""Generate Android launcher icons and splash screens for the CrazyTypewriter APK.

Design: site-blue (#25AEF3) background, white keyboard glyph (matches the web
app's favicon color and typing theme). Redraws the PNG resources inside
android/app/src/main/res/ that the Capacitor template ships with defaults.

Usage: python3 scripts/generate-android-icons.py   (run from repo root)
"""

from pathlib import Path

from PIL import Image, ImageDraw

RES = Path(__file__).resolve().parent.parent / "android/app/src/main/res"

BLUE = (37, 174, 243, 255)      # #25AEF3 site favicon blue
NAVY = (0, 17, 34, 255)         # #001122 app dark background
WHITE = (255, 255, 255, 255)
TRANSPARENT = (0, 0, 0, 0)

# Supersampling factor: draw large, downscale with LANCZOS for smooth edges.
SS = 12


def draw_keyboard_glyph(draw: ImageDraw.ImageDraw, x: float, y: float, s: float, color) -> None:
    """Draw a keyboard glyph inside the box (x, y, s, s) in unit coordinates."""
    r = s * 0.06  # corner radius scale

    # Keyboard body: white rounded rectangle
    draw.rounded_rectangle(
        [x + s * 0.09, y + s * 0.33, x + s * 0.91, y + s * 0.67],
        radius=r,
        fill=color,
    )

    key = s * 0.055  # key square side
    # Row of keys across the upper band
    keys = 8
    span = s * 0.70
    step = span / keys
    kx = x + s * 0.15
    ky = y + s * 0.405
    for i in range(keys):
        cx = kx + i * step + (step - key) / 2
        draw.rounded_rectangle(
            [cx, ky, cx + key, ky + key], radius=key * 0.25, fill=BLUE
        )

    # Spacebar centered below the key row
    sw = s * 0.34
    sx = x + (s - sw) / 2
    sy = y + s * 0.525
    draw.rounded_rectangle(
        [sx, sy, sx + sw, sy + s * 0.058], radius=s * 0.014, fill=BLUE
    )


def make_launcher(size: int, round_shape: bool) -> Image.Image:
    """Legacy launcher icon: full-bleed blue circle + white keyboard glyph."""
    c = size * SS
    img = Image.new("RGBA", (c, c), TRANSPARENT)
    d = ImageDraw.Draw(img)
    if round_shape:
        d.ellipse([0, 0, c - 1, c - 1], fill=BLUE)
    else:
        d.ellipse([0, 0, c - 1, c - 1], fill=BLUE)
    g = c * 0.62
    draw_keyboard_glyph(d, (c - g) / 2, (c - g) / 2, g, WHITE)
    return img.resize((size, size), Image.LANCZOS)


def make_foreground(size: int) -> Image.Image:
    """Adaptive-icon foreground: transparent canvas, glyph inside the 66/108 safe zone."""
    c = size * SS
    img = Image.new("RGBA", (c, c), TRANSPARENT)
    d = ImageDraw.Draw(img)
    g = c * 0.55
    draw_keyboard_glyph(d, (c - g) / 2, (c - g) / 2, g, WHITE)
    return img.resize((size, size), Image.LANCZOS)


def make_splash(w: int, h: int) -> Image.Image:
    """Splash screen: navy background + centered blue circle icon."""
    cw, ch = w * SS, h * SS
    img = Image.new("RGBA", (cw, ch), NAVY)
    d = ImageDraw.Draw(img)
    icon_d = min(cw, ch) * 0.30
    cx, cy = (cw - icon_d) / 2, (ch - icon_d) / 2
    d.ellipse([cx, cy, cx + icon_d, cy + icon_d], fill=BLUE)
    g = icon_d * 0.62
    draw_keyboard_glyph(d, cx + (icon_d - g) / 2, cy + (icon_d - g) / 2, g, WHITE)
    return img.resize((w, h), Image.LANCZOS)


DENSITIES = {
    "mdpi": 1,
    "hdpi": 1.5,
    "xhdpi": 2,
    "xxhdpi": 3,
    "xxxhdpi": 4,
}


def main() -> None:
    for density, scale in DENSITIES.items():
        launcher = int(48 * scale)
        foreground = int(108 * scale)
        mipmap = RES / f"mipmap-{density}"
        make_launcher(launcher, round_shape=False).save(mipmap / "ic_launcher.png")
        make_launcher(launcher, round_shape=True).save(mipmap / "ic_launcher_round.png")
        make_foreground(foreground).save(mipmap / "ic_launcher_foreground.png")
        print(f"mipmap-{density}: launcher {launcher}px, foreground {foreground}px")

    splash_sizes = {
        "drawable/splash.png": (480, 320),
        "drawable-port-mdpi/splash.png": (320, 480),
        "drawable-port-hdpi/splash.png": (480, 800),
        "drawable-port-xhdpi/splash.png": (720, 1280),
        "drawable-port-xxhdpi/splash.png": (960, 1600),
        "drawable-port-xxxhdpi/splash.png": (1280, 1920),
        "drawable-land-mdpi/splash.png": (480, 320),
        "drawable-land-hdpi/splash.png": (800, 480),
        "drawable-land-xhdpi/splash.png": (1280, 720),
        "drawable-land-xxhdpi/splash.png": (1600, 960),
        "drawable-land-xxxhdpi/splash.png": (1920, 1280),
    }
    for rel, (w, h) in splash_sizes.items():
        make_splash(w, h).save(RES / rel)
        print(f"{rel}: {w}x{h}")

    print("done")


if __name__ == "__main__":
    main()
