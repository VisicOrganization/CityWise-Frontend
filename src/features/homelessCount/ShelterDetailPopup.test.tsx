import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ShelterDetailPopup } from "./ShelterDetailPopup";

afterEach(cleanup);

describe("ShelterDetailPopup", () => {
  it("renders the fields a record actually carries", () => {
    render(
      <ShelterDetailPopup
        properties={{
          name: "Valley Shelter",
          addrln1: "123 Main St",
          city: "Los Angeles",
          state: "CA",
          zip: "91605",
          phones: "(818) 555-0100",
          hours: "24 hours",
          cat1: "Emergency shelter",
        }}
      />,
    );

    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Valley Shelter");
    expect(screen.getByText("123 Main St, Los Angeles, CA 91605")).toBeInTheDocument();
    expect(screen.getByText("(818) 555-0100")).toBeInTheDocument();
    expect(screen.getByText("Emergency shelter")).toBeInTheDocument();
  });

  it("falls back to org_name when name is absent", () => {
    render(<ShelterDetailPopup properties={{ org_name: "LAHSA" }} />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("LAHSA");
  });

  // Values come from a third-party tile, not our own types, so an empty record must not crash.
  it("renders a generic title for a record with nothing in it", () => {
    render(<ShelterDetailPopup properties={{}} />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Shelter or service");
  });

  it("ignores non-string field values instead of printing them", () => {
    render(
      <ShelterDetailPopup
        properties={{ name: 42, org_name: null, phones: { toString: () => "x" }, hours: [] }}
      />,
    );

    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Shelter or service");
    expect(screen.queryByText("42")).not.toBeInTheDocument();
  });

  // The join is the whole point of buildAddress: a missing part must not leave a dangling comma.
  it.each([
    [{ addrln1: "123 Main St" }, "123 Main St"],
    [{ city: "Los Angeles", state: "CA" }, "Los Angeles, CA"],
    [{ addrln1: "123 Main St", zip: "91605" }, "123 Main St, 91605"],
    [
      { addrln1: "123 Main St", addrln2: "Apt 4", city: "Los Angeles", state: "CA", zip: "91605" },
      "123 Main St Apt 4, Los Angeles, CA 91605",
    ],
  ])("joins only the address parts that are present (%#)", (properties, expected) => {
    render(<ShelterDetailPopup properties={{ name: "X", ...properties }} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("omits the address line entirely when no part is present", () => {
    const { container } = render(<ShelterDetailPopup properties={{ name: "Valley Shelter" }} />);
    expect(container.querySelectorAll(".homeless-count-popup-source")).toHaveLength(0);
  });

  it("joins the category fields that are filled", () => {
    render(
      <ShelterDetailPopup
        properties={{ name: "X", cat1: "Shelter", cat2: "", cat3: "Meals" }}
      />,
    );
    expect(screen.getByText("Shelter, Meals")).toBeInTheDocument();
  });

  it("opens an external link safely in a new tab", () => {
    render(<ShelterDetailPopup properties={{ name: "X", url: "https://lahsa.org" }} />);

    const link = screen.getByRole("link", { name: "https://lahsa.org" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("falls back to `link` when `url` is absent", () => {
    render(<ShelterDetailPopup properties={{ name: "X", link: "https://example.org" }} />);
    expect(screen.getByRole("link", { name: "https://example.org" })).toBeInTheDocument();
  });
});
