"""Petals bright on pure deep dark-green; no light plate disk."""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

src = Path(__file__).with_name("ref-soft-flowers.png")
out = Path(__file__).with_name("ref-soft-flowers-dark.png")

im = Image.open(src).convert("RGBA")
arr = np.asarray(im).astype(np.float32)
r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
h, w = r.shape

mx = np.maximum(np.maximum(r, g), b)
mn = np.minimum(np.minimum(r, g), b)
lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
chroma = mx - mn
sat = chroma / (mx + 1e-6)

orange = (r > 168) & ((r - b) > 48) & (sat > 0.24) & (chroma > 42)

seed = Image.fromarray((orange.astype(np.uint8) * 255), "L")
near = seed.filter(ImageFilter.MaxFilter(17)).filter(ImageFilter.GaussianBlur(10))
near_f = np.asarray(near).astype(np.float32) / 255.0

blue_detail = (b > 130) & ((b - r) > 22) & (chroma > 28) & (lum < 195)
stem = (g > 75) & (g + 5 >= r) & (chroma > 14) & (lum < 150) & (lum > 45)
support = (blue_detail | stem) & (near_f > 0.28)

keep = orange | support
keep_img = Image.fromarray((keep.astype(np.uint8) * 255), "L")
keep_img = keep_img.filter(ImageFilter.MaxFilter(5))
keep_img = keep_img.filter(ImageFilter.GaussianBlur(radius=3.5))
alpha = np.asarray(keep_img).astype(np.float32) / 255.0

# Soft warm bloom only (no grey plate): orange proximity * warm chroma
warm = np.clip((r - b) / 90.0, 0, 1) * np.clip(sat / 0.4, 0, 1)
bloom = near_f * warm * 0.35
alpha = np.clip(np.maximum(alpha, bloom), 0, 1)

# Strip pale / grey / peach plate
plate = np.clip((lum - 160) / 50.0, 0, 1) * np.clip((0.4 - sat) / 0.4, 0, 1)
alpha *= 1.0 - plate
# Strip bottom atmospheric blue
yy, xx = np.mgrid[0:h, 0:w]
bottom = np.clip((yy - h * 0.58) / (h * 0.3), 0, 1)
alpha *= 1.0 - bottom * np.clip((b - r) / 70.0, 0, 1) * (1.0 - near_f) * 0.98

alpha = np.asarray(
    Image.fromarray((np.clip(alpha, 0, 1) * 255).astype(np.uint8), "L").filter(
        ImageFilter.GaussianBlur(1.8)
    )
).astype(np.float32) / 255.0

dark = np.array([4.0, 14.0, 11.0], dtype=np.float32)

fg = np.clip(arr[:, :, :3] * 1.5 + 28, 0, 255)
ow = np.asarray(
    Image.fromarray((orange.astype(np.uint8) * 255), "L").filter(ImageFilter.GaussianBlur(3))
).astype(np.float32) / 255.0
fg[:, :, 0] = np.clip(fg[:, :, 0] + ow * 45, 0, 255)
fg[:, :, 1] = np.clip(fg[:, :, 1] + ow * 16, 0, 255)

out_rgb = np.zeros_like(fg)
for i in range(3):
    out_rgb[:, :, i] = fg[:, :, i] * alpha + dark[i] * (1.0 - alpha)

# Kill residual light-grey blobs (low chroma leftovers)
out_lum = out_rgb.mean(axis=2)
out_ch = out_rgb.max(axis=2) - out_rgb.min(axis=2)
residual = np.clip((out_lum - 40) / 35.0, 0, 1) * np.clip((50.0 - out_ch) / 50.0, 0, 1)
# also kill medium grey islands
residual = np.maximum(
    residual,
    np.clip((out_lum - 55) / 45.0, 0, 1) * np.clip((70.0 - out_ch) / 70.0, 0, 1) * 0.9,
)
for i in range(3):
    out_rgb[:, :, i] = out_rgb[:, :, i] * (1.0 - residual) + dark[i] * residual

# Vignette
ell = ((yy - h / 2) / (h * 0.58)) ** 2 + ((xx - w / 2) / (w * 0.58)) ** 2
t = np.clip((ell - 0.52) / 0.95, 0, 1)
edge = t * t * (3 - 2 * t)
for i in range(3):
    out_rgb[:, :, i] = out_rgb[:, :, i] * (1.0 - edge) + dark[i] * edge

out_rgb = np.clip(out_rgb, 0, 255)
Image.fromarray(np.dstack([out_rgb, np.full((h, w), 255.0)]).astype(np.uint8), "RGBA").save(
    out, optimize=True
)
print("saved", out, "alpha", float(alpha.mean()), "lum", float(out_rgb.mean()))
