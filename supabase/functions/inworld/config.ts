export interface InworldRequestBody {
  text: string;
  voiceId: string;
  modelId: string;
  audioConfig: {
    audioEncoding: "MP3";
    speakingRate: number;
  };
  temperature: number;
}

const VOICE_ID = "default-o-lizv8yves-5uhgzcrjog__ok";
const MODEL_ID = "inworld-tts-1.5-mini";
const SPEAKING_RATE = 0.8;
const TEMPERATURE = 1.0;

export function buildInworldRequestBody(text: string): InworldRequestBody {
  return {
    text,
    voiceId: VOICE_ID,
    modelId: MODEL_ID,
    audioConfig: {
      audioEncoding: "MP3",
      speakingRate: SPEAKING_RATE,
    },
    temperature: TEMPERATURE,
  };
}
