import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { renderHook, act } from "@testing-library/react-hooks";
import { VoiceAdapter, VoiceCaptureError } from "../adapters/VoiceAdapter";
import { useVoiceCapture } from "../hooks/useVoiceCapture";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockStopTrack = vi.fn();

const mockStream = {
  getTracks: vi.fn(() => [{ stop: mockStopTrack }]),
  getAudioTracks: vi.fn(() => [{ stop: mockStopTrack }]),
};

const mockMediaRecorder = {
  start: vi.fn(),
  stop: vi.fn(),
  ondataavailable: null as ((event: BlobEvent) => void) | null,
  onstop: null as (() => void) | null,
  onerror: null as ((event: Event) => void) | null,
  state: "inactive",
  stream: mockStream,
};

mockMediaRecorder.start.mockImplementation(() => {
  mockMediaRecorder.state = "recording";
});

mockMediaRecorder.stop.mockImplementation(() => {
  mockMediaRecorder.state = "inactive";
});

const mockGetUserMedia = vi.fn(() => Promise.resolve(mockStream));

Object.defineProperty(global.navigator, "mediaDevices", {
  value: {
    getUserMedia: mockGetUserMedia,
  },
  writable: true,
});

Object.defineProperty(global, "MediaRecorder", {
  value: vi.fn(() => mockMediaRecorder),
  writable: true,
});

class MockBlob extends Blob {}

Object.defineProperty(global, "Blob", {
  value: MockBlob,
  writable: true,
});

const MockFileReader = vi.fn().mockImplementation(() => ({
  onload: null as ((event: ProgressEvent<FileReader>) => void) | null,
  onerror: null as ((event: ProgressEvent<FileReader>) => void) | null,
  result: null as string | ArrayBuffer | null,
  readAsDataURL(blob: Blob) {
    this.result = `data:${blob.type};base64,SGVsbG8gV29ybGQ=`;
    (this.onload as ((event: ProgressEvent<FileReader>) => void) | null)?.(
      new ProgressEvent("load"),
    );
  },
}));

Object.defineProperty(global, "FileReader", {
  value: MockFileReader,
  writable: true,
});

const getInvokeMock = () => supabase.functions.invoke as unknown as Mock;

describe("VoiceAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mockMediaRecorder.state = "inactive";
    mockGetUserMedia.mockResolvedValue(mockStream);
  });

  it("should successfully transcribe audio and extract fields", async () => {
    const mockAudioBlob = new Blob(["test audio data"], { type: "audio/webm" });
    const mockResponse = {
      data: {
        transcription: "Gastei 50 reais no mercado",
        extracted_fields: {
          valor: 50,
          tipo: "expense",
          descricao: "mercado",
          data: "2023-01-01",
          categoria: "Alimentação",
          moeda: "BRL",
          warnings: [],
        },
        confidence: 0.9,
      },
      error: null,
    };

    getInvokeMock().mockResolvedValue(mockResponse);

    const result = await VoiceAdapter.transcribe(mockAudioBlob);

    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      "smart-capture-voice",
      expect.objectContaining({
        body: expect.objectContaining({
          audio_base64: expect.any(String),
          mime_type: "audio/webm",
        }),
      }),
    );

    expect(result).toEqual({
      text: "Gastei 50 reais no mercado",
      confidence: 0.9,
      metadata: {
        valor: 50,
        tipo: "expense",
        descricao: "mercado",
        data: "2023-01-01",
        categoria: "Alimentação",
        moeda: "BRL",
        warnings: [],
      },
    });
  });

  it("should throw AUTH_REQUIRED error if supabase returns 401", async () => {
    const mockAudioBlob = new Blob(["test audio data"], { type: "audio/webm" });
    const mockError = {
      status: 401,
      message: "Unauthorized",
    };

    getInvokeMock().mockResolvedValue({ data: null, error: mockError });

    await expect(VoiceAdapter.transcribe(mockAudioBlob)).rejects.toThrow(VoiceCaptureError);
    await expect(VoiceAdapter.transcribe(mockAudioBlob)).rejects.toHaveProperty("code", "AUTH_REQUIRED");
  });

  it("should throw AUDIO_TOO_LARGE error if supabase returns 413", async () => {
    const mockAudioBlob = new Blob(["test audio data"], { type: "audio/webm" });
    const mockError = {
      status: 413,
      message: "Audio file exceeds 15MB",
    };

    getInvokeMock().mockResolvedValue({ data: null, error: mockError });

    await expect(VoiceAdapter.transcribe(mockAudioBlob)).rejects.toThrow(VoiceCaptureError);
    await expect(VoiceAdapter.transcribe(mockAudioBlob)).rejects.toHaveProperty("code", "AUDIO_TOO_LARGE");
  });

  it("should throw VOICE_NOT_CONFIGURED error if OPENAI_API_KEY is missing", async () => {
    const mockAudioBlob = new Blob(["test audio data"], { type: "audio/webm" });
    const mockError = {
      status: 500,
      message: "OPENAI_API_KEY is not configured",
    };

    getInvokeMock().mockResolvedValue({ data: null, error: mockError });

    await expect(VoiceAdapter.transcribe(mockAudioBlob)).rejects.toThrow(VoiceCaptureError);
    await expect(VoiceAdapter.transcribe(mockAudioBlob)).rejects.toHaveProperty("code", "VOICE_NOT_CONFIGURED");
  });

  it("should throw VOICE_EMPTY_TEXT error if transcription is empty", async () => {
    const mockAudioBlob = new Blob(["test audio data"], { type: "audio/webm" });
    const mockResponse = {
      data: {
        transcription: "",
        extracted_fields: {},
        confidence: 0.5,
      },
      error: null,
    };

    getInvokeMock().mockResolvedValue(mockResponse);

    await expect(VoiceAdapter.transcribe(mockAudioBlob)).rejects.toThrow(VoiceCaptureError);
    await expect(VoiceAdapter.transcribe(mockAudioBlob)).rejects.toHaveProperty("code", "VOICE_EMPTY_TEXT");
  });

  it("should throw UPSTREAM_VOICE_ERROR for generic supabase errors", async () => {
    const mockAudioBlob = new Blob(["test audio data"], { type: "audio/webm" });
    const mockError = {
      status: 500,
      message: "Some other backend error",
    };

    getInvokeMock().mockResolvedValue({ data: null, error: mockError });

    await expect(VoiceAdapter.transcribe(mockAudioBlob)).rejects.toThrow(VoiceCaptureError);
    await expect(VoiceAdapter.transcribe(mockAudioBlob)).rejects.toHaveProperty("code", "UPSTREAM_VOICE_ERROR");
  });
});

describe("useVoiceCapture", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mockMediaRecorder.state = "inactive";
    mockGetUserMedia.mockResolvedValue(mockStream);
  });

  it("should start and stop recording successfully", async () => {
    const { result } = renderHook(() => useVoiceCapture());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(mockMediaRecorder.start).toHaveBeenCalled();
    expect(result.current.isRecording).toBe(true);
    expect(result.current.isTranscribing).toBe(false);
    expect(toast.info).toHaveBeenCalledWith("Gravando áudio...");

    await act(async () => {
      result.current.stopRecording();
    });

    expect(mockMediaRecorder.stop).toHaveBeenCalled();

    act(() => {
      mockMediaRecorder.onstop?.();
    });

    expect(result.current.isRecording).toBe(false);
  });

  it("should handle successful transcription after stopping recording", async () => {
    const mockTranscriptionResult = {
      text: "Teste de transcrição",
      confidence: 0.9,
      metadata: { valor: 10, tipo: "expense" },
    };

    vi.spyOn(VoiceAdapter, "transcribe").mockResolvedValue(mockTranscriptionResult);

    const { result } = renderHook(() => useVoiceCapture());

    await act(async () => {
      await result.current.startRecording();
    });

    act(() => {
      mockMediaRecorder.ondataavailable?.({ data: new Blob(["chunk1"]) } as BlobEvent);
    });

    await act(async () => {
      await mockMediaRecorder.onstop?.();
    });

    expect(result.current.isTranscribing).toBe(false);
    expect(result.current.result).toEqual(mockTranscriptionResult);
    expect(toast.success).toHaveBeenCalledWith("Transcrição de voz concluída!", expect.any(Object));
  });

  it("should handle microphone access error", async () => {
    mockGetUserMedia.mockRejectedValueOnce(new Error("Permission denied"));

    const { result } = renderHook(() => useVoiceCapture());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(false);
    expect(result.current.isTranscribing).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(
      "Falha na captura de voz",
      expect.objectContaining({
        description: "Permission denied",
      }),
    );
  });

  it("should handle transcription error", async () => {
    const mockError = new VoiceCaptureError("UPSTREAM_VOICE_ERROR", "Backend error");

    vi.spyOn(VoiceAdapter, "transcribe").mockRejectedValue(mockError);

    const { result } = renderHook(() => useVoiceCapture());

    await act(async () => {
      await result.current.startRecording();
    });

    act(() => {
      mockMediaRecorder.ondataavailable?.({ data: new Blob(["chunk1"]) } as BlobEvent);
    });

    await act(async () => {
      await mockMediaRecorder.onstop?.();
    });

    expect(result.current.isTranscribing).toBe(false);
    expect(result.current.result).toBeNull();
    expect(toast.error).toHaveBeenCalledWith(
      "Falha no provedor de voz",
      expect.objectContaining({
        description: "Backend error",
      }),
    );
  });

  it("should reset voice capture state", async () => {
    const { result } = renderHook(() => useVoiceCapture());

    await act(async () => {
      await result.current.startRecording();
    });

    act(() => {
      result.current.resetVoice();
    });

    expect(result.current.isRecording).toBe(false);
    expect(result.current.isTranscribing).toBe(false);
    expect(result.current.result).toBeNull();
    expect(mockStopTrack).toHaveBeenCalled();
  });
});
