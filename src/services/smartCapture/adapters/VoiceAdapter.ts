/**
 * FinanceAI — Voice Adapter
 * Responsável por transcrever áudio para texto.
 * Preparado para integração com OpenAI Whisper ou similar.
 */

export interface VoiceTranscriptionResult {
  text: string;
  confidence: number;
  duration?: number;
}

export class VoiceAdapter {
  /**
   * Transcreve um Blob de áudio para texto.
   * Atualmente implementa um mock/fallback que simula a transcrição.
   */
  static async transcribe(audioBlob: Blob): Promise<VoiceTranscriptionResult> {
    console.log("Transcrevendo áudio de tamanho:", audioBlob.size);
    
    // Simulação de processamento
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // TODO: Implementar chamada real para API (ex: OpenAI Whisper)
    // const formData = new FormData();
    // formData.append("file", audioBlob);
    // const response = await fetch("api/transcribe", { method: "POST", body: formData });
    
    // Fallback/Mock para demonstração do fluxo
    return {
      text: "Gastei 45 reais com almoço hoje no restaurante",
      confidence: 0.95,
      duration: 2.5
    };
  }
}
