import { describe, expect, it } from 'vitest';
import {
  baseFamily,
  outputTypeLabel,
  resolveFitVerdict,
  resolveOutputType,
  resolveRecordOutputType,
  TIGHT_FIT_RATIO,
} from './domain';

describe('baseFamily', () => {
  it('groups versioned llama families under llama', () => {
    expect(baseFamily('llama-3.1')).toBe('llama');
    expect(baseFamily('llama-3.2')).toBe('llama');
    expect(baseFamily('llama3.3')).toBe('llama');
    expect(baseFamily('llama-4')).toBe('llama');
  });

  it('strips version and variant suffixes from other families', () => {
    expect(baseFamily('qwen2.5')).toBe('qwen');
    expect(baseFamily('qwen2.5-coder')).toBe('qwen');
    expect(baseFamily('qwen3.8')).toBe('qwen');
    expect(baseFamily('deepseek-r1')).toBe('deepseek');
    expect(baseFamily('deepseek-v3')).toBe('deepseek');
    expect(baseFamily('gemma-3n')).toBe('gemma');
  });

  it('keeps unversioned families and normalizes casing', () => {
    expect(baseFamily('Mistral')).toBe('mistral');
    expect(baseFamily('tinyllama')).toBe('tinyllama');
  });
});

describe('resolveFitVerdict', () => {
  const hostBudget = 1000;

  it('returns nofit when the model does not fit', () => {
    expect(resolveFitVerdict({ fits: false, est_total_bytes: 100 }, hostBudget)).toBe('nofit');
  });

  it('returns tight when the model uses more than 90% of the budget', () => {
    expect(resolveFitVerdict({ fits: true, est_total_bytes: 950 }, hostBudget)).toBe('tight');
  });

  it('returns fits when the model uses 90% or less of the budget', () => {
    expect(
      resolveFitVerdict({ fits: true, est_total_bytes: hostBudget * TIGHT_FIT_RATIO }, hostBudget)
    ).toBe('fits');
    expect(resolveFitVerdict({ fits: true, est_total_bytes: 500 }, hostBudget)).toBe('fits');
  });
});

describe('resolveRecordOutputType', () => {
  it('prefers an explicit non-text output type', () => {
    expect(resolveRecordOutputType({ entry_id: 'some-model', output_type: 'image' })).toBe('image');
    expect(resolveRecordOutputType({ entry_id: 'some-model', output_type: 'embedding' })).toBe(
      'embedding'
    );
  });

  it('falls back to the entry id when output_type is missing or text', () => {
    expect(resolveRecordOutputType({ entry_id: 'nomic-embed-text-v1' })).toBe('embedding');
    expect(resolveRecordOutputType({ entry_id: 'nomic-embed-text-v1', output_type: 'text' })).toBe(
      'embedding'
    );
    expect(resolveRecordOutputType({ entry_id: 'llama-3.1-8b-instruct', output_type: null })).toBe(
      'text'
    );
  });
});

describe('resolveOutputType', () => {
  const baseEntry = {
    id: 'llama-3.1-8b-instruct',
    filename: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
    repo_id: 'bartowski/Meta-Llama-3.1-8B-Instruct-GGUF',
    family: 'llama',
    tags: ['general'],
  };

  it('honors an explicit output type', () => {
    expect(resolveOutputType({ ...baseEntry, output_type: 'embedding' })).toBe('embedding');
  });

  it('detects embeddings from catalog metadata when output_type is absent', () => {
    expect(
      resolveOutputType({
        ...baseEntry,
        id: 'bge-small-en-v1.5',
        filename: 'bge-small-en-v1.5-q8_0.gguf',
        repo_id: 'second-state/BGE-Small-EN-v1.5-GGUF',
        family: 'bge',
        tags: ['embedding'],
      })
    ).toBe('embedding');
  });

  it('defaults to text for generation models', () => {
    expect(resolveOutputType({ ...baseEntry, output_type: 'text' })).toBe('text');
    expect(resolveOutputType(baseEntry)).toBe('text');
  });
});

describe('outputTypeLabel', () => {
  it('labels embedding output explicitly and defaults to Text', () => {
    expect(outputTypeLabel('embedding')).toBe('Embedding');
    expect(outputTypeLabel('text')).toBe('Text');
    expect(outputTypeLabel(undefined)).toBe('Text');
  });
});
