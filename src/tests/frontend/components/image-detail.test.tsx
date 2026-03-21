import { type ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImageDetail } from "@/components/image-detail";
import { createGalleryImage } from "../helpers/gallery-image";

function renderImageDetail(
  overrides: Partial<ComponentProps<typeof ImageDetail>> = {},
) {
  const image = createGalleryImage({
    id: "image-1",
    path: "C:\\gallery\\image-1.png",
    src: "konomi://local/C%3A%2Fgallery%2Fimage-1.png",
  });
  const props: ComponentProps<typeof ImageDetail> = {
    image,
    isOpen: true,
    onClose: vi.fn(),
    onToggleFavorite: vi.fn(),
    onCopyPrompt: vi.fn(),
    onAddTagToSearch: vi.fn(),
    onAddTagToGenerator: vi.fn(),
    prevImage: null,
    nextImage: null,
    onPrev: vi.fn(),
    onNext: vi.fn(),
    ...overrides,
  };

  return {
    ...render(<ImageDetail {...props} />),
    props,
  };
}

function getSimilarPanel(): HTMLElement {
  const panel = screen.getByText("Similar Images").parentElement;
  if (!(panel instanceof HTMLElement)) {
    throw new Error("Failed to find similar images panel");
  }
  return panel;
}

function getSimilarThumbButtons(panel: HTMLElement): HTMLButtonElement[] {
  const thumbsViewport = panel.children[1];
  if (!(thumbsViewport instanceof HTMLElement)) {
    throw new Error("Failed to find similar thumbnails viewport");
  }
  return within(thumbsViewport).getAllByRole("button") as HTMLButtonElement[];
}

function getSimilarPagerButtons(panel: HTMLElement): HTMLButtonElement[] {
  const pager = panel.children[2];
  if (!(pager instanceof HTMLElement)) {
    throw new Error("Failed to find similar images pager");
  }
  return within(pager).getAllByRole("button") as HTMLButtonElement[];
}

describe("ImageDetail", () => {
  it("shows a loading state for the similar images panel while detail content is pending", () => {
    renderImageDetail({
      detailContentReady: false,
      similarImagesLoading: true,
    });

    const panel = getSimilarPanel();
    expect(within(panel).getByText("Loading...")).toBeInTheDocument();
  });

  it("shows none when there are no related similar images beyond the current image", () => {
    const image = createGalleryImage({
      id: "solo-image",
      path: "C:\\gallery\\solo-image.png",
      src: "konomi://local/C%3A%2Fgallery%2Fsolo-image.png",
    });

    renderImageDetail({
      image,
      similarImages: [image],
    });

    const panel = getSimilarPanel();
    expect(within(panel).getByText("None")).toBeInTheDocument();
  });

  it("paginates similar images and only opens non-current similar thumbnails", async () => {
    const user = userEvent.setup();
    const currentImage = createGalleryImage({
      id: "image-1",
      path: "C:\\gallery\\image-1.png",
      src: "konomi://local/C%3A%2Fgallery%2Fimage-1.png",
    });
    const visualImage = createGalleryImage({
      id: "image-2",
      path: "C:\\gallery\\image-2.png",
      src: "konomi://local/C%3A%2Fgallery%2Fimage-2.png",
    });
    const promptImage = createGalleryImage({
      id: "image-3",
      path: "C:\\gallery\\image-3.png",
      src: "konomi://local/C%3A%2Fgallery%2Fimage-3.png",
    });
    const bothImage = createGalleryImage({
      id: "image-4",
      path: "C:\\gallery\\image-4.png",
      src: "konomi://local/C%3A%2Fgallery%2Fimage-4.png",
    });
    const onSimilarImageClick = vi.fn();

    renderImageDetail({
      image: currentImage,
      similarImages: [currentImage, visualImage, promptImage, bothImage],
      similarReasons: {
        "image-2": "visual",
        "image-3": "prompt",
        "image-4": "both",
      },
      onSimilarImageClick,
      similarPageSize: 2,
    });

    const panel = getSimilarPanel();
    const thumbsViewport = panel.children[1] as HTMLElement;
    const pager = panel.children[2] as HTMLElement;
    const [currentThumb, visualThumb] = getSimilarThumbButtons(panel);

    expect(within(pager).getByText("1/2")).toBeInTheDocument();
    expect(within(thumbsViewport).getByText("V")).toBeInTheDocument();

    await user.click(currentThumb);
    expect(onSimilarImageClick).not.toHaveBeenCalled();

    await user.click(visualThumb);
    expect(onSimilarImageClick).toHaveBeenCalledWith(visualImage);

    const [, nextPageButton] = getSimilarPagerButtons(panel);
    await user.click(nextPageButton);

    expect(within(pager).getByText("2/2")).toBeInTheDocument();
    expect(within(thumbsViewport).getByText("P")).toBeInTheDocument();
    expect(within(thumbsViewport).getByText("B")).toBeInTheDocument();
  });

  it("resets the similar images page when the selected image changes", async () => {
    const user = userEvent.setup();
    const firstImage = createGalleryImage({
      id: "image-10",
      path: "C:\\gallery\\image-10.png",
      src: "konomi://local/C%3A%2Fgallery%2Fimage-10.png",
    });
    const secondImage = createGalleryImage({
      id: "image-11",
      path: "C:\\gallery\\image-11.png",
      src: "konomi://local/C%3A%2Fgallery%2Fimage-11.png",
    });
    const thirdImage = createGalleryImage({
      id: "image-12",
      path: "C:\\gallery\\image-12.png",
      src: "konomi://local/C%3A%2Fgallery%2Fimage-12.png",
    });
    const fourthImage = createGalleryImage({
      id: "image-13",
      path: "C:\\gallery\\image-13.png",
      src: "konomi://local/C%3A%2Fgallery%2Fimage-13.png",
    });

    const { rerender, props } = renderImageDetail({
      image: firstImage,
      similarImages: [firstImage, secondImage, thirdImage, fourthImage],
      similarPageSize: 2,
    });

    const panel = getSimilarPanel();
    const [, nextPageButton] = getSimilarPagerButtons(panel);

    await user.click(nextPageButton);
    expect(within(panel).getByText("2/2")).toBeInTheDocument();

    rerender(
      <ImageDetail
        {...props}
        image={secondImage}
        similarImages={[secondImage, thirdImage, fourthImage, firstImage]}
      />,
    );

    expect(within(panel).getByText("1/2")).toBeInTheDocument();
  });

  it("keeps showing similar thumbnails when the list shrinks for the same selected image", async () => {
    const user = userEvent.setup();
    const currentImage = createGalleryImage({
      id: "image-20",
      path: "C:\\gallery\\image-20.png",
      src: "konomi://local/C%3A%2Fgallery%2Fimage-20.png",
    });
    const secondImage = createGalleryImage({
      id: "image-21",
      path: "C:\\gallery\\image-21.png",
      src: "konomi://local/C%3A%2Fgallery%2Fimage-21.png",
    });
    const thirdImage = createGalleryImage({
      id: "image-22",
      path: "C:\\gallery\\image-22.png",
      src: "konomi://local/C%3A%2Fgallery%2Fimage-22.png",
    });
    const fourthImage = createGalleryImage({
      id: "image-23",
      path: "C:\\gallery\\image-23.png",
      src: "konomi://local/C%3A%2Fgallery%2Fimage-23.png",
    });

    const { rerender, props } = renderImageDetail({
      image: currentImage,
      similarImages: [currentImage, secondImage, thirdImage, fourthImage],
      similarPageSize: 2,
    });

    const panel = getSimilarPanel();
    const [, nextPageButton] = getSimilarPagerButtons(panel);
    await user.click(nextPageButton);

    expect(within(panel).getByText("2/2")).toBeInTheDocument();

    rerender(
      <ImageDetail
        {...props}
        image={currentImage}
        similarImages={[currentImage, secondImage]}
      />,
    );

    expect(getSimilarThumbButtons(panel)).toHaveLength(2);
    expect(within(panel).queryByText("2/2")).not.toBeInTheDocument();
  });
});
