import { describe, expect, test } from "bun:test";

import { usernamePreviewInput, usernamePreviewState } from "./username-preview";

describe("usernamePreviewInput", () => {
  test("trims the parts", () => {
    expect(
      usernamePreviewInput({
        firstName: " Juan ",
        lastName: "Pérez",
        documentNumber: " 11012345 ",
      }),
    ).toEqual({ firstName: "Juan", lastName: "Pérez", documentNumber: "11012345" });
  });

  test("is null while any part is blank", () => {
    expect(
      usernamePreviewInput({ firstName: "Juan", lastName: " ", documentNumber: "11012345" }),
    ).toBeNull();
    expect(
      usernamePreviewInput({ firstName: "", lastName: "Pérez", documentNumber: "11012345" }),
    ).toBeNull();
  });
});

describe("usernamePreviewState", () => {
  const idle = { enabled: true, pending: false, isFetching: false, isError: false };

  test("is idle until the inputs are complete", () => {
    expect(usernamePreviewState({ ...idle, enabled: false, data: undefined })).toEqual({
      status: "idle",
    });
  });

  test("loads while the debounce or the request runs", () => {
    expect(usernamePreviewState({ ...idle, pending: true, data: undefined })).toEqual({
      status: "loading",
    });
    expect(usernamePreviewState({ ...idle, isFetching: true, data: undefined })).toEqual({
      status: "loading",
    });
  });

  test("shows the generated username and flags a taken document", () => {
    expect(
      usernamePreviewState({ ...idle, data: { username: "jperez4501", documentTaken: true } }),
    ).toEqual({ status: "ready", username: "jperez4501", documentTaken: true });
  });

  test("a null username (no letters in the names) is unavailable", () => {
    expect(
      usernamePreviewState({ ...idle, data: { username: null, documentTaken: false } }),
    ).toEqual({ status: "unavailable", documentTaken: false });
  });

  test("a failed request is an error", () => {
    expect(usernamePreviewState({ ...idle, isError: true, data: undefined })).toEqual({
      status: "error",
    });
  });
});
