import { describe, expect, it } from "vitest";
import { buildInworldRequestBody } from "./config.ts";

describe("buildInworldRequestBody", () => {
  it("utilise la voix Videogen avec Inworld 1.5 Mini", () => {
    expect(buildInworldRequestBody("Bonjour")).toEqual({
      text: "Bonjour",
      voiceId: "default-o-lizv8yves-5uhgzcrjog__ok",
      modelId: "inworld-tts-1.5-mini",
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 0.8,
      },
      temperature: 1.0,
    });
  });
});
