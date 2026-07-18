import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import type { LessonPlan } from "../../lesson/lib/plan";
import { LiveGoalEntry } from "./LiveGoalEntry";

const pcbPlan: LessonPlan = {
  goal: "assemble a simple led pcb",
  steps: [
    {
      n: 1,
      say: "Place the bare board with the labels facing up.",
      overlay: [{ type: "label", at: [0.5, 0.5], text: "component side" }],
    },
  ],
};

describe("LiveGoalEntry", () => {
  it("accepts a nonempty goal from another domain and gives its plan to the shared executor", async () => {
    const getPlan = jest.fn().mockResolvedValue(pcbPlan);
    const onPlanReady = jest.fn();

    await render(<LiveGoalEntry getPlan={getPlan} onPlanReady={onPlanReady} />);

    await fireEvent.changeText(
      screen.getByLabelText("What would you like to learn?"),
      "  assemble a simple led pcb  ",
    );
    await fireEvent.press(screen.getByRole("button", { name: "Plan lesson" }));

    await waitFor(() => expect(onPlanReady).toHaveBeenCalledWith(pcbPlan));

    expect(getPlan).toHaveBeenCalledWith("assemble a simple led pcb");
  });

  it("keeps a visible planning state on screen while a goal is being generated", async () => {
    const getPlan = jest.fn(() => new Promise<LessonPlan>(() => undefined));

    await render(<LiveGoalEntry getPlan={getPlan} onPlanReady={jest.fn()} />);

    await fireEvent.changeText(
      screen.getByLabelText("What would you like to learn?"),
      "make a walnut coffee table",
    );
    await fireEvent.press(screen.getByRole("button", { name: "Plan lesson" }));

    expect(screen.getByLabelText("Lesson planning")).toBeTruthy();
    expect(screen.getByText("Planning…")).toBeTruthy();
    expect(screen.getByText("Building your make a walnut coffee table lesson.")).toBeTruthy();
  });

  it("shows a retryable error when planning fails, then gives a retried cooking plan to the executor", async () => {
    const cookingPlan: LessonPlan = {
      ...pcbPlan,
      goal: "cook a vegetable stir-fry",
    };
    const getPlan = jest
      .fn<Promise<LessonPlan>, [string]>()
      .mockRejectedValueOnce(new Error("The planner is unavailable."))
      .mockResolvedValueOnce(cookingPlan);
    const onPlanReady = jest.fn();

    await render(<LiveGoalEntry getPlan={getPlan} onPlanReady={onPlanReady} />);

    await fireEvent.changeText(
      screen.getByLabelText("What would you like to learn?"),
      "cook a vegetable stir-fry",
    );
    await fireEvent.press(screen.getByRole("button", { name: "Plan lesson" }));

    await screen.findByLabelText("Lesson planning error");

    expect(screen.getByText("The planner is unavailable.")).toBeTruthy();
    expect(onPlanReady).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole("button", { name: "Retry planning" }));

    await waitFor(() => expect(onPlanReady).toHaveBeenCalledWith(cookingPlan));
    expect(getPlan).toHaveBeenNthCalledWith(1, "cook a vegetable stir-fry");
    expect(getPlan).toHaveBeenNthCalledWith(2, "cook a vegetable stir-fry");
  });

  it("does not start the executor with an invalid generated plan", async () => {
    const invalidPlan = {
      goal: "build a birdhouse",
      steps: [{ n: 2, say: "Attach the roof.", overlay: [] }],
    } as unknown as LessonPlan;
    const getPlan = jest.fn().mockResolvedValue(invalidPlan);
    const onPlanReady = jest.fn();

    await render(<LiveGoalEntry getPlan={getPlan} onPlanReady={onPlanReady} />);

    await fireEvent.changeText(
      screen.getByLabelText("What would you like to learn?"),
      "build a birdhouse",
    );
    await fireEvent.press(screen.getByRole("button", { name: "Plan lesson" }));

    await screen.findByLabelText("Lesson planning error");

    expect(
      screen.getByText("The planner returned an invalid lesson: step 1 has the wrong sequence number"),
    ).toBeTruthy();
    expect(onPlanReady).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Retry planning" })).toBeTruthy();
  });
});
