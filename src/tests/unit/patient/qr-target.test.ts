import { describe, expect, it } from "vitest";
import {
  clinicPathFromCode,
  clinicPathFromQr,
} from "@/components/patient/qr-target";

describe("clinicPathFromQr", () => {
  it.each([
    ["https://queuecare.example.in/q/demo-clinic", "/q/demo-clinic"],
    ["http://localhost:3000/q/demo-clinic/", "/q/demo-clinic"],
    ["https://clinic.example/Q/Demo-Clinic", "/q/demo-clinic"],
    ["/q/sunrise-dental", "/q/sunrise-dental"],
  ])("opens the clinic page for %s", (text, path) => {
    expect(clinicPathFromQr(text)).toBe(path);
  });

  it.each([
    "https://evil.example/login",
    "https://queuecare.example.in/receptionist",
    "https://queuecare.example.in/q/demo-clinic/join/123",
    "https://queuecare.example.in/q/../admin",
    "javascript:alert(1)",
    "upi://pay?pa=shop@bank",
    "Just some text",
    "",
  ])("ignores %s", (text) => {
    expect(clinicPathFromQr(text)).toBeNull();
  });
});

describe("clinicPathFromCode", () => {
  it("accepts a typed clinic code or a pasted clinic link", () => {
    expect(clinicPathFromCode(" Demo-Clinic ")).toBe("/q/demo-clinic");
    expect(clinicPathFromCode("https://site.example/q/demo-clinic")).toBe(
      "/q/demo-clinic",
    );
  });

  it("rejects anything else", () => {
    expect(clinicPathFromCode("demo clinic")).toBeNull();
    expect(clinicPathFromCode("../admin")).toBeNull();
  });
});
