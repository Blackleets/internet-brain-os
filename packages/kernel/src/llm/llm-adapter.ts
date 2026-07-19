import type { LLMRequest, LLMResponse } from '@internet-brain-os/shared';

/** Provider-neutral completion boundary used by the Kernel and Skills. */
export interface LLMAdapter {
  readonly name: string;
  complete(input: LLMRequest): Promise<LLMResponse>;
}
