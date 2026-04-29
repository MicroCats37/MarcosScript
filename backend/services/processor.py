"""Photo processing service using Pillow for image compositing."""
import os
from typing import Optional

from PIL import Image


def composite_frame_onto_photo(
    source_path: str,
    frame_path: str,
    output_path: str,
    opacity: float = 1.0,
) -> bool:
    """
    Composite a frame PNG onto a source photo.

    Args:
        source_path: Path to the source photo (JPG/JPEG/PNG).
        frame_path: Path to the frame overlay (PNG with transparency).
        output_path: Path where the composited result will be saved.
        opacity: Frame opacity multiplier (0.0 to 1.0).

    Returns:
        True if compositing succeeded, False otherwise.
    """
    try:
        # Open source image
        source = Image.open(source_path).convert("RGBA")

        # Open frame image
        frame = Image.open(frame_path).convert("RGBA")

        # Resize frame to match source dimensions if needed
        if frame.size != source.size:
            frame = frame.resize(source.size, Image.Resampling.LANCZOS)

        # Apply opacity to frame
        if opacity < 1.0:
            alpha = frame.split()[3]
            alpha = alpha.point(lambda p: int(p * opacity))
            frame.putalpha(alpha)

        # Composite frame onto source
        result = Image.alpha_composite(source, frame)

        # Convert back to RGB for JPG output, or keep RGBA for PNG
        if output_path.lower().endswith(".png"):
            result.save(output_path, format="PNG")
        else:
            # Convert to RGB (removing alpha) for JPEG
            result_rgb = result.convert("RGB")
            result_rgb.save(output_path, format="JPEG", quality=95)

        return True

    except Exception as e:
        # Log error in production; for now just return failure
        print(f"Error compositing {source_path} with frame {frame_path}: {e}")
        return False


def process_photo_with_frames(
    source_path: str,
    frame_paths: list[str],
    output_dir: str,
    output_prefix: str = "processed_",
    opacity: float = 1.0,
) -> list[dict]:
    """
    Process a single photo with multiple frames.

    Args:
        source_path: Path to source photo.
        frame_paths: List of paths to frame overlay images.
        output_dir: Directory to save processed outputs.
        output_prefix: Prefix for output filenames.
        opacity: Opacity multiplier for frames.

    Returns:
        List of dicts with keys: frame_filename, output_filename, success.
    """
    os.makedirs(output_dir, exist_ok=True)

    source_basename = os.path.splitext(os.path.basename(source_path))[0]
    results = []

    for frame_path in frame_paths:
        frame_basename = os.path.splitext(os.path.basename(frame_path))[0]
        output_filename = f"{output_prefix}{source_basename}_{frame_basename}.jpg"
        output_path = os.path.join(output_dir, output_filename)

        success = composite_frame_onto_photo(
            source_path=source_path,
            frame_path=frame_path,
            output_path=output_path,
            opacity=opacity,
        )

        results.append({
            "frame_filename": os.path.basename(frame_path),
            "output_filename": output_filename if success else None,
            "success": success,
        })

    return results