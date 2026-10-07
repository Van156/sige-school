import { describe, expect, mock, test } from "bun:test";

import {
  SIGN_IN_FALLBACK_MESSAGE,
  SIGN_IN_INVALID_MESSAGE,
  SIGN_IN_RATE_LIMITED_MESSAGE,
  firstNameOf,
  isEmailIdentifier,
  signInErrorMessage,
  signInWithIdentifier,
} from "./sige-sign-in";

describe("signInWithIdentifier", () => {
  test("an identifier with @ signs in by email", async () => {
    const client = { email: mock(async () => "email"), username: mock(async () => "username") };
    expect(await signInWithIdentifier(client, " ana@colegio.co ", "secreto")).toBe("email");
    expect(client.email).toHaveBeenCalledWith({ email: "ana@colegio.co", password: "secreto" });
    expect(client.username).not.toHaveBeenCalled();
  });

  test("an identifier without @ signs in by username", async () => {
    const client = { email: mock(async () => "email"), username: mock(async () => "username") };
    expect(await signInWithIdentifier(client, "mgomez3456", "52123456")).toBe("username");
    expect(client.username).toHaveBeenCalledWith({ username: "mgomez3456", password: "52123456" });
    expect(client.email).not.toHaveBeenCalled();
  });

  test("detects emails", () => {
    expect(isEmailIdentifier("a@b")).toBe(true);
    expect(isEmailIdentifier("usuario")).toBe(false);
  });
});

describe("signInErrorMessage", () => {
  test("shows the server message verbatim for a deactivated account", () => {
    const error = {
      status: 403,
      code: "ACCOUNT_DISABLED",
      message: "Su cuenta está desactivada. Contacte al administrador.",
    };
    expect(signInErrorMessage(error)).toBe(error.message);
  });

  test("bad credentials, whatever the server wording, are one message", () => {
    expect(signInErrorMessage({ status: 401, code: "INVALID_USERNAME_OR_PASSWORD" })).toBe(
      SIGN_IN_INVALID_MESSAGE,
    );
    expect(signInErrorMessage({ status: 401, message: "Invalid email or password" })).toBe(
      SIGN_IN_INVALID_MESSAGE,
    );
  });

  test("429 maps to the rate-limit message", () => {
    expect(signInErrorMessage({ status: 429 })).toBe(SIGN_IN_RATE_LIMITED_MESSAGE);
  });

  test("server and network failures use the fallback", () => {
    expect(signInErrorMessage({ status: 500 })).toBe(SIGN_IN_FALLBACK_MESSAGE);
    expect(signInErrorMessage(new Error("offline"))).toBe(SIGN_IN_FALLBACK_MESSAGE);
  });
});

describe("firstNameOf", () => {
  test("takes the first word", () => {
    expect(firstNameOf("Marta Lucía Gómez")).toBe("Marta");
    expect(firstNameOf(undefined)).toBe("");
  });
});
