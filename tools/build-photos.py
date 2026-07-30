#!/usr/bin/env python3
"""
build-photos.py — regenerate the web derivatives in assets/photos/.

Masters live in assets/photos/_originals/ (git-ignored). This emits the
widths each photo is actually rendered at, in WebP and JPEG, and strips all
camera metadata on the way out. That last part is not optional: one master
(Leadership-Planning-Workshop) carries GPS coordinates for a private home,
and this site is public.

Requested widths are capped at each master's native width — nothing is ever
upscaled. A master smaller than every requested width is emitted once at its
native size instead.

`sips` can decode WebP but not encode it, so this uses Pillow. That is a
local authoring dependency only — the published site still ships no
dependencies and no build step.

Install once:  python3 -m pip install Pillow
Run:           ./tools/build-photos.py
"""

from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "photos" / "_originals"
OUT = ROOT / "assets" / "photos"

WEBP_QUALITY = 80
JPEG_QUALITY = 78

# master filename -> (published slug, widths to emit)
#
# Widths follow the placement, not the master. The band and the two
# in-context photos run large, so they get both tiers. The mission cells
# never render wider than ~295px, so a second tier there would only ever be
# dead weight in the repo.
#
# Masters absent from this map stay archived but unpublished.
PHOTOS = {
    # Band + in-context — large placements
    "SpringRetreat2025_3.JPG": ("spring-retreat-2025-3", (800, 1600)),
    "SpringRetreat2025_2.JPG": ("spring-retreat-2025-2", (800, 1600)),
    "Giving-Cafe2.jpg": ("giving-cafe-2", (800, 1600)),
    "Giving-Cafe1.jpg": ("giving-cafe-1", (800, 1600)),
    "Leadership-Planning-Workshop.jpg": ("leadership-planning-workshop", (800, 1600)),
    "Graduation-Ceremony.jpg": ("graduation-ceremony", (800, 1600)),
    # Four Missions cells — small placements, single tier.
    # Tzu Chi official imagery; see SUMMARY.md.
    "Philippines-disaster-relief-7.3.26.jpg": ("mission-charity-philippines", (800,)),
    "Nepal-medical-relief-4.25.15.jpg": ("mission-medicine-nepal", (800,)),
    "Nepal-womens-sewing-classes-6.24.26.jpeg": ("mission-education-nepal", (800,)),
    "Japanese-earthquake-survivor-peacecharm-6.25.26.jpg": ("mission-culture-japan", (800,)),
}


def clean(path):
    """Open an image, honor its EXIF orientation, then drop every tag.

    Copying the pixel data into a fresh Image is what actually severs the
    metadata — saving without an `exif=` argument alone is not reliable
    across formats.
    """
    with Image.open(path) as src:
        oriented = ImageOps.exif_transpose(src).convert("RGB")
        return Image.frombytes("RGB", oriented.size, oriented.tobytes())


def widths_for(requested, native):
    """Requested widths that the master can actually fill, never upscaling.

    A master narrower than everything requested is emitted once at native
    width rather than skipped — small is better than blurry.
    """
    usable = [w for w in requested if w <= native]
    return usable or [native]


def main():
    if not SRC.is_dir():
        raise SystemExit(
            f"error: {SRC} not found. Masters are git-ignored — restore them "
            "from the chapter Drive before regenerating."
        )

    OUT.mkdir(parents=True, exist_ok=True)
    published = set()

    for master, (slug, requested) in PHOTOS.items():
        path = SRC / master
        if not path.is_file():
            print(f"skip:  {master} not present")
            continue

        image = clean(path)
        emitted = []
        for width in widths_for(requested, image.width):
            height = round(image.height * width / image.width)
            resized = image.resize((width, height), Image.LANCZOS)
            resized.save(OUT / f"{slug}-{width}.webp", "WEBP", quality=WEBP_QUALITY, method=6)
            resized.save(
                OUT / f"{slug}-{width}.jpg",
                "JPEG",
                quality=JPEG_QUALITY,
                optimize=True,
                progressive=True,
            )
            emitted.append(f"{width}x{height}")
            published.update({f"{slug}-{width}.webp", f"{slug}-{width}.jpg"})

        capped = " (capped at native)" if image.width < max(requested) else ""
        print(f"built: {slug:<32} {', '.join(emitted)}{capped}")

    verify(published)


def verify(published):
    """Fail loudly if any derivative still carries EXIF, and point out files
    left behind by a renamed or retired photo."""
    print("\nVerifying metadata was stripped:")
    dirty = []
    on_disk = set()
    for path in sorted(OUT.glob("*")):
        if path.suffix.lower() not in {".jpg", ".webp"}:
            continue
        on_disk.add(path.name)
        with Image.open(path) as img:
            if img.getexif():
                dirty.append(path.name)

    if dirty:
        raise SystemExit("  LEAK: EXIF survived in " + ", ".join(dirty))
    print("  clean — no EXIF, no coordinates in any derivative.")

    orphans = on_disk - published
    if orphans:
        print("\nOrphaned derivatives (no longer produced by this script):")
        for name in sorted(orphans):
            print(f"  {name}")


if __name__ == "__main__":
    main()
