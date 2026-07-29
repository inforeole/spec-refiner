import { describe, expect, it } from "vitest";
import { buildInworldRequestBody } from "./config.ts";

describe("buildInworldRequestBody", () => {
  it("utilise Vanessa avec un rendu rapide et expressif", () => {
    expect(buildInworldRequestBody("Bonjour")).toEqual({
      text: "Bonjour",
      voiceId: "default-o-lizv8yves-5uhgzcrjog__vanessa",
      modelId: "inworld-tts-1.5-mini",
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 1.05,
      },
      temperature: 1.5,
    });
  });
});
