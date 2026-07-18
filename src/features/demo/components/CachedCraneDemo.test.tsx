import { fireEvent, render, screen } from "@testing-library/react-native";

import { CachedCraneDemo } from "./CachedCraneDemo";

describe("CachedCraneDemo", () => {
  it("starts on the cached crane's first step with its matching narration and overlay", async () => {
    await render(<CachedCraneDemo />);

    expect(screen.getByText("Step 1 of 6")).toBeTruthy();
    expect(
      screen.getByText(
        "Place the paper in the square. Fold the bottom left corner to the top right corner, then crease it firmly.",
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText("Overlay for step 1")).toBeTruthy();
    expect(screen.getByText("first diagonal")).toBeTruthy();
  });

  it("moves narration and the displayed overlay to the next step together", async () => {
    await render(<CachedCraneDemo />);

    await fireEvent.press(screen.getByRole("button", { name: "Next step" }));

    expect(screen.getByText("Step 2 of 6")).toBeTruthy();
    expect(
      screen.getByText(
        "Open the paper. Now fold the bottom right corner to the top left corner and make the second diagonal crease.",
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText("Overlay for step 2")).toBeTruthy();
    expect(screen.queryByText("first diagonal")).toBeNull();
  });

  it("closes after the final step and narrates the completion message", async () => {
    const onNarrate = jest.fn();

    await render(<CachedCraneDemo onNarrate={onNarrate} />);

    for (let step = 0; step < 6; step += 1) {
      await fireEvent.press(screen.getByRole("button", { name: "Next step" }));
    }

    expect(screen.getByLabelText("Lesson complete")).toBeTruthy();
    expect(screen.getByText("You made a paper crane.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next step" })).toBeNull();
    expect(onNarrate).toHaveBeenLastCalledWith("You made a paper crane.");
  });
});
