"""Tests for the processor.py image compositing service."""
import os

import pytest
from PIL import Image

from backend.services.processor import composite_frame_onto_photo, process_photo_with_frames


class TestCompositeFrameOntoPhoto:
    """Tests for composite_frame_onto_photo function."""

    def test_composite_jpg_output(
        self, dummy_source_image: str, dummy_frame_png: str, temp_image_dir: str
    ):
        """Test compositing a PNG frame onto a JPG source produces a valid JPEG."""
        output_path = os.path.join(temp_image_dir, "output.jpg")

        result = composite_frame_onto_photo(
            source_path=dummy_source_image,
            frame_path=dummy_frame_png,
            output_path=output_path,
        )

        assert result is True
        assert os.path.exists(output_path)

        # Verify output is a valid image
        output_img = Image.open(output_path)
        assert output_img.size == (100, 100)
        output_img.close()

    def test_composite_png_output(
        self, dummy_source_image: str, dummy_frame_png: str, temp_image_dir: str
    ):
        """Test compositing a PNG frame onto a source produces a valid PNG when specified."""
        output_path = os.path.join(temp_image_dir, "output.png")

        result = composite_frame_onto_photo(
            source_path=dummy_source_image,
            frame_path=dummy_frame_png,
            output_path=output_path,
        )

        assert result is True
        assert os.path.exists(output_path)

        output_img = Image.open(output_path)
        assert output_img.size == (100, 100)
        assert output_img.mode == "RGBA"
        output_img.close()

    def test_composite_with_opacity(
        self, dummy_source_image: str, dummy_frame_png: str, temp_image_dir: str
    ):
        """Test compositing with reduced opacity."""
        output_path = os.path.join(temp_image_dir, "output_opacity.jpg")

        result = composite_frame_onto_photo(
            source_path=dummy_source_image,
            frame_path=dummy_frame_png,
            output_path=output_path,
            opacity=0.5,
        )

        assert result is True
        assert os.path.exists(output_path)

    def test_composite_with_full_opacity(
        self, dummy_source_image: str, dummy_frame_png: str, temp_image_dir: str
    ):
        """Test compositing with full opacity (default)."""
        output_path = os.path.join(temp_image_dir, "output_full.jpg")

        result = composite_frame_onto_photo(
            source_path=dummy_source_image,
            frame_path=dummy_frame_png,
            output_path=output_path,
            opacity=1.0,
        )

        assert result is True
        assert os.path.exists(output_path)

    def test_composite_with_resize(
        self, dummy_source_image: str, temp_image_dir: str
    ):
        """Test that frames are resized to match source image dimensions."""
        # Create a smaller frame
        small_frame = os.path.join(temp_image_dir, "small_frame.png")
        img = Image.new("RGBA", (50, 50), color=(255, 0, 0, 128))
        img.save(small_frame, format="PNG")

        output_path = os.path.join(temp_image_dir, "output_resized.jpg")

        result = composite_frame_onto_photo(
            source_path=dummy_source_image,
            frame_path=small_frame,
            output_path=output_path,
        )

        assert result is True
        output_img = Image.open(output_path)
        assert output_img.size == (100, 100)  # Should be resized to match source
        output_img.close()

    def test_composite_nonexistent_source(self, dummy_frame_png: str, temp_image_dir: str):
        """Test that nonexistent source file returns False."""
        output_path = os.path.join(temp_image_dir, "output.jpg")

        result = composite_frame_onto_photo(
            source_path="/nonexistent/source.jpg",
            frame_path=dummy_frame_png,
            output_path=output_path,
        )

        assert result is False
        assert not os.path.exists(output_path)

    def test_composite_nonexistent_frame(self, dummy_source_image: str, temp_image_dir: str):
        """Test that nonexistent frame file returns False."""
        output_path = os.path.join(temp_image_dir, "output.jpg")

        result = composite_frame_onto_photo(
            source_path=dummy_source_image,
            frame_path="/nonexistent/frame.png",
            output_path=output_path,
        )

        assert result is False
        assert not os.path.exists(output_path)


class TestProcessPhotoWithFrames:
    """Tests for process_photo_with_frames function."""

    def test_process_single_frame(
        self, dummy_source_image: str, dummy_frame_png: str, temp_image_dir: str
    ):
        """Test processing a photo with a single frame."""
        results = process_photo_with_frames(
            source_path=dummy_source_image,
            frame_paths=[dummy_frame_png],
            output_dir=temp_image_dir,
            output_prefix="processed_",
        )

        assert len(results) == 1
        assert results[0]["frame_filename"] == "frame.png"
        assert results[0]["success"] is True
        assert results[0]["output_filename"] is not None
        assert os.path.exists(os.path.join(temp_image_dir, results[0]["output_filename"]))

    def test_process_multiple_frames(
        self, dummy_source_image: str, temp_image_dir: str
    ):
        """Test processing a photo with multiple frames."""
        # Create multiple frames
        frame1 = os.path.join(temp_image_dir, "frame1.png")
        frame2 = os.path.join(temp_image_dir, "frame2.png")
        frame3 = os.path.join(temp_image_dir, "frame3.png")

        Image.new("RGBA", (100, 100), color=(255, 0, 0, 128)).save(frame1, format="PNG")
        Image.new("RGBA", (100, 100), color=(0, 255, 0, 128)).save(frame2, format="PNG")
        Image.new("RGBA", (100, 100), color=(0, 0, 255, 128)).save(frame3, format="PNG")

        results = process_photo_with_frames(
            source_path=dummy_source_image,
            frame_paths=[frame1, frame2, frame3],
            output_dir=temp_image_dir,
            output_prefix="processed_",
        )

        assert len(results) == 3
        assert all(r["success"] for r in results)
        assert all(r["output_filename"] is not None for r in results)

    def test_process_creates_output_directory(
        self, dummy_source_image: str, dummy_frame_png: str, temp_image_dir: str
    ):
        """Test that output directory is created if it doesn't exist."""
        output_subdir = os.path.join(temp_image_dir, "subdir", "nested")
        results = process_photo_with_frames(
            source_path=dummy_source_image,
            frame_paths=[dummy_frame_png],
            output_dir=output_subdir,
            output_prefix="processed_",
        )

        assert len(results) == 1
        assert results[0]["success"] is True
        assert os.path.exists(output_subdir)

    def test_process_with_custom_prefix(
        self, dummy_source_image: str, dummy_frame_png: str, temp_image_dir: str
    ):
        """Test that custom output prefix is applied correctly."""
        results = process_photo_with_frames(
            source_path=dummy_source_image,
            frame_paths=[dummy_frame_png],
            output_dir=temp_image_dir,
            output_prefix="custom_",
        )

        assert results[0]["output_filename"].startswith("custom_")

    def test_process_with_opacity(
        self, dummy_source_image: str, dummy_frame_png: str, temp_image_dir: str
    ):
        """Test processing with custom opacity."""
        results = process_photo_with_frames(
            source_path=dummy_source_image,
            frame_paths=[dummy_frame_png],
            output_dir=temp_image_dir,
            output_prefix="processed_",
            opacity=0.75,
        )

        assert len(results) == 1
        assert results[0]["success"] is True

    def test_process_nonexistent_source_returns_failed_results(
        self, dummy_frame_png: str, temp_image_dir: str
    ):
        """Test that processing with nonexistent source returns failed results."""
        results = process_photo_with_frames(
            source_path="/nonexistent/source.jpg",
            frame_paths=[dummy_frame_png],
            output_dir=temp_image_dir,
            output_prefix="processed_",
        )

        assert len(results) == 1
        assert results[0]["success"] is False
        assert results[0]["output_filename"] is None
