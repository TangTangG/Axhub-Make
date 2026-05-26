import type { AiImageGenerationConfig } from './projectCore/index.ts';

export type AiImageQuality = 'auto' | 'low' | 'medium' | 'high';
export type AiImageOutputFormat = 'png' | 'jpeg' | 'webp';
export type AiImageModeration = 'auto' | 'low';

export interface AiImageTaskParams {
  size: string;
  quality: AiImageQuality;
  output_format: AiImageOutputFormat;
  output_compression: number | null;
  moderation: AiImageModeration;
  n: number;
  disable_prompt_optimization?: boolean;
}

export interface AiImageGenerateOptions {
  config: AiImageGenerationConfig;
  prompt: string;
  params: Partial<AiImageTaskParams>;
  referenceImages?: string[];
  fetchImpl?: typeof fetch;
}

export interface AiImageGenerateResult {
  images: string[];
  actualParams?: Partial<AiImageTaskParams>;
  actualParamsList?: Array<Partial<AiImageTaskParams> | undefined>;
  revisedPrompts?: Array<string | undefined>;
  rawImageUrls?: string[];
  rawResponsePayload?: string;
}

interface ImageApiResponse {
  data?: Array<{
    b64_json?: string;
    url?: string;
    revised_prompt?: string;
  }>;
  revised_prompt?: string;
  [key: string]: unknown;
}

interface ResponsesApiResponse {
  output?: Array<{
    type?: string;
    result?: unknown;
    revised_prompt?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function pickActualParams(source: unknown): Partial<AiImageTaskParams> | undefined {
  if (!isRecordValue(source)) return undefined;
  const actualParams: Partial<AiImageTaskParams> = {};

  if (typeof source.size === 'string') actualParams.size = source.size;
  if (source.quality === 'auto' || source.quality === 'low' || source.quality === 'medium' || source.quality === 'high') {
    actualParams.quality = source.quality;
  }
  if (source.output_format === 'png' || source.output_format === 'jpeg' || source.output_format === 'webp') {
    actualParams.output_format = source.output_format;
  }
  if (typeof source.output_compression === 'number') actualParams.output_compression = source.output_compression;
  if (source.moderation === 'auto' || source.moderation === 'low') actualParams.moderation = source.moderation;
  if (typeof source.n === 'number') actualParams.n = source.n;
  if (typeof source.disable_prompt_optimization === 'boolean') {
    actualParams.disable_prompt_optimization = source.disable_prompt_optimization;
  }

  return Object.keys(actualParams).length ? actualParams : undefined;
}

function mergeActualParams(...sources: Array<Partial<AiImageTaskParams> | undefined>): Partial<AiImageTaskParams> | undefined {
  const merged = Object.assign({}, ...sources.filter((source) => source && Object.keys(source).length));
  return Object.keys(merged).length ? merged : undefined;
}

const MIME_MAP: Record<AiImageOutputFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

const PROMPT_REWRITE_GUARD_PREFIX = 'Use the following text as the complete prompt. Do not rewrite it:';

export function normalizeAiImageRequestParams(
  input: Partial<AiImageTaskParams> | undefined,
  defaults: AiImageGenerationConfig,
): AiImageTaskParams {
  const quality = input?.quality === 'auto' || input?.quality === 'low' || input?.quality === 'medium' || input?.quality === 'high'
    ? input.quality
    : defaults.quality;
  const outputFormat = input?.output_format === 'png' || input?.output_format === 'jpeg' || input?.output_format === 'webp'
    ? input.output_format
    : defaults.outputFormat;
  const moderation = input?.moderation === 'auto' || input?.moderation === 'low'
    ? input.moderation
    : defaults.moderation;
  const n = typeof input?.n === 'number' && Number.isFinite(input.n)
    ? Math.min(10, Math.max(1, Math.round(input.n)))
    : defaults.n;
  const outputCompression = input?.output_compression == null
    ? defaults.outputCompression
    : typeof input.output_compression === 'number' && Number.isFinite(input.output_compression)
      ? Math.min(100, Math.max(0, Math.round(input.output_compression)))
      : defaults.outputCompression;

  return {
    size: typeof input?.size === 'string' && input.size.trim() ? input.size.trim() : defaults.size,
    quality,
    output_format: outputFormat,
    output_compression: outputCompression,
    moderation,
    n,
    disable_prompt_optimization: input?.disable_prompt_optimization === true,
  };
}

function buildApiUrl(baseUrl: string, endpointPath: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/u, '');
  const normalizedPath = endpointPath.replace(/^\/+/u, '');
  return normalizedBaseUrl.endsWith('/v1')
    ? `${normalizedBaseUrl}/${normalizedPath}`
    : `${normalizedBaseUrl}/v1/${normalizedPath}`;
}

function normalizeBase64Image(value: string, fallbackMime: string): string {
  return value.startsWith('data:') ? value : `data:${fallbackMime};base64,${value}`;
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function isDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:');
}

async function blobToDataUrl(blob: Blob, fallbackMime: string): Promise<string> {
  const buffer = Buffer.from(await blob.arrayBuffer());
  return `data:${blob.type || fallbackMime};base64,${buffer.toString('base64')}`;
}

async function fetchImageUrlAsDataUrl(url: string, fallbackMime: string, fetchImpl: typeof fetch, signal?: AbortSignal): Promise<string> {
  if (isDataUrl(url)) return url;
  const response = await fetchImpl(url, { cache: 'no-store', signal });
  if (!response.ok) {
    throw new Error(`图片 URL 下载失败：HTTP ${response.status}`);
  }
  return blobToDataUrl(await response.blob(), fallbackMime);
}

async function getApiErrorMessage(response: Response): Promise<string> {
  let errorMsg = `HTTP ${response.status}`;
  try {
    const errJson = await response.json();
    if (errJson.error?.message) errorMsg = errJson.error.message;
    else if (typeof errJson.detail === 'string') errorMsg = errJson.detail;
    else if (Array.isArray(errJson.detail)) errorMsg = errJson.detail.map((item: unknown) => typeof item === 'string' ? item : JSON.stringify(item)).join('\n');
    else if (typeof errJson.error === 'string') errorMsg = errJson.error;
    else if (errJson.message) errorMsg = errJson.message;
  } catch {
    try {
      errorMsg = await response.text();
    } catch {
      // Keep HTTP fallback.
    }
  }
  return errorMsg;
}

function createAbortController(timeoutSeconds: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
  return { controller, timeoutId };
}

function getRawErrorPayload(err: unknown): Pick<Partial<AiImageGenerateResult>, 'rawImageUrls'> & { rawResponsePayload?: string } {
  const anyErr = err as any;
  return {
    ...(Array.isArray(anyErr?.rawImageUrls) ? { rawImageUrls: anyErr.rawImageUrls } : {}),
    ...(typeof anyErr?.rawResponsePayload === 'string' ? { rawResponsePayload: anyErr.rawResponsePayload } : {}),
  };
}

function createPersistableRawResponsePayload(payload: unknown): string {
  return JSON.stringify(payload, (key, value) => {
    if (
      typeof value === 'string'
      && (
        key === 'b64_json'
        || key === 'base64'
        || key === 'result'
        || (value.length > 96 && /^[A-Za-z0-9+/]+={0,2}$/u.test(value))
      )
    ) {
      return '<base64_data>';
    }
    return value;
  }, 2);
}

function mergeRawResponsePayloads(results: AiImageGenerateResult[]): string | undefined {
  const payloads = results
    .map((result) => result.rawResponsePayload)
    .filter((payload): payload is string => Boolean(payload));
  if (!payloads.length) return undefined;
  if (payloads.length === 1) return payloads[0];

  return JSON.stringify(payloads.map((payload, index) => {
    try {
      return {
        requestIndex: index,
        response: JSON.parse(payload),
      };
    } catch {
      return {
        requestIndex: index,
        response: payload,
      };
    }
  }), null, 2);
}

async function parseImagesApiResponse(payload: ImageApiResponse, mime: string, fetchImpl: typeof fetch, signal?: AbortSignal): Promise<AiImageGenerateResult> {
  const data = payload.data;
  if (!Array.isArray(data) || !data.length) {
    const err = new Error('接口没有返回图片数据，请查看原始响应内容确认服务商实际返回的数据结构。');
    (err as any).rawResponsePayload = JSON.stringify(payload, null, 2);
    throw err;
  }

  const images: string[] = [];
  const revisedPrompts: Array<string | undefined> = [];
  const rawImageUrls = data.map((item) => item.url).filter(isHttpUrl);
  try {
    for (const item of data) {
      if (item.b64_json) {
        images.push(normalizeBase64Image(item.b64_json, mime));
        revisedPrompts.push(typeof item.revised_prompt === 'string' ? item.revised_prompt : undefined);
        continue;
      }
      if (isHttpUrl(item.url) || isDataUrl(item.url)) {
        images.push(await fetchImageUrlAsDataUrl(item.url, mime, fetchImpl, signal));
        revisedPrompts.push(typeof item.revised_prompt === 'string' ? item.revised_prompt : undefined);
      }
    }
  } catch (error) {
    if (rawImageUrls.length && error instanceof Error) {
      (error as any).rawImageUrls = rawImageUrls;
    }
    throw error;
  }

  if (!images.length) {
    const err = new Error('接口没有返回可识别的图片数据，请查看原始响应内容确认服务商实际返回的数据结构。');
    (err as any).rawResponsePayload = JSON.stringify(payload, null, 2);
    throw err;
  }

  const actualParams = mergeActualParams(pickActualParams(payload));
  return {
    images,
    revisedPrompts,
    actualParams,
    actualParamsList: images.map(() => actualParams),
    ...(rawImageUrls.length ? { rawImageUrls } : {}),
    rawResponsePayload: createPersistableRawResponsePayload(payload),
  };
}

function getResponsesImageResultBase64(result: unknown): string | undefined {
  const b64 = typeof result === 'string'
    ? result
    : isRecordValue(result)
      ? typeof result.b64_json === 'string'
        ? result.b64_json
        : typeof result.base64 === 'string'
          ? result.base64
          : typeof result.image === 'string'
            ? result.image
            : typeof result.data === 'string'
              ? result.data
              : ''
      : '';

  return b64.trim() ? b64 : undefined;
}

function parseResponsesImageResults(payload: ResponsesApiResponse, fallbackMime: string): AiImageGenerateResult {
  const output = payload.output;
  if (!Array.isArray(output) || !output.length) {
    const err = new Error('接口未返回图片数据');
    (err as any).rawResponsePayload = JSON.stringify(payload, null, 2);
    throw err;
  }

  const images: string[] = [];
  const revisedPrompts: Array<string | undefined> = [];
  const actualParamsList: Array<Partial<AiImageTaskParams> | undefined> = [];
  for (const item of output) {
    if (item?.type !== 'image_generation_call') continue;
    const b64 = getResponsesImageResultBase64(item.result);
    if (b64) {
      images.push(normalizeBase64Image(b64, fallbackMime));
      revisedPrompts.push(typeof item.revised_prompt === 'string' ? item.revised_prompt : undefined);
      actualParamsList.push(mergeActualParams(pickActualParams(item)));
    }
  }

  if (!images.length) {
    const err = new Error('接口没有返回可识别的图片数据，请查看原始响应内容确认服务商实际返回的数据结构。');
    (err as any).rawResponsePayload = JSON.stringify(payload, null, 2);
    throw err;
  }

  const actualParams = mergeActualParams(actualParamsList[0]);
  return {
    images,
    revisedPrompts,
    actualParams,
    actualParamsList,
    rawResponsePayload: createPersistableRawResponsePayload(payload),
  };
}

async function callImagesApiSingle(options: AiImageGenerateOptions, params: AiImageTaskParams, fetchImpl: typeof fetch): Promise<AiImageGenerateResult> {
  const { config } = options;
  const mime = MIME_MAP[params.output_format] || 'image/png';
  const { controller, timeoutId } = createAbortController(config.timeout);
  try {
    const prompt = params.disable_prompt_optimization
      ? `${PROMPT_REWRITE_GUARD_PREFIX}\n${options.prompt}`
      : options.prompt;
    const body: Record<string, unknown> = {
      model: config.model,
      prompt,
      size: params.size,
      output_format: params.output_format,
      moderation: params.moderation,
    };
    if (!config.codexCli) {
      body.quality = params.quality;
    }
    if (params.output_format !== 'png' && params.output_compression != null) {
      body.output_compression = params.output_compression;
    }
    if (params.n > 1) {
      body.n = params.n;
    }
    if (config.responseFormatB64Json) {
      body.response_format = 'b64_json';
    }
    if (options.referenceImages?.length) {
      body.reference_images = options.referenceImages;
    }

    const response = await fetchImpl(buildApiUrl(config.baseUrl, 'images/generations'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response));
    }
    const result = await parseImagesApiResponse(await response.json() as ImageApiResponse, mime, fetchImpl, controller.signal);
    return {
      ...result,
      actualParams: mergeActualParams(result.actualParams, { n: result.images.length }),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callImagesApiConcurrent(options: AiImageGenerateOptions, params: AiImageTaskParams, fetchImpl: typeof fetch): Promise<AiImageGenerateResult> {
  const results = await Promise.allSettled(
    Array.from({ length: params.n }).map(() => callImagesApiSingle(options, { ...params, quality: 'auto', n: 1 }, fetchImpl)),
  );
  const successfulResults = results
    .filter((result): result is PromiseFulfilledResult<AiImageGenerateResult> => result.status === 'fulfilled')
    .map((result) => result.value);

  if (!successfulResults.length) {
    const firstError = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (firstError) throw firstError.reason;
    throw new Error('所有并发请求均失败');
  }

  const images = successfulResults.flatMap((result) => result.images);
  const actualParamsList = successfulResults.flatMap((result) => (
    result.actualParamsList?.length
      ? result.actualParamsList
      : result.images.map(() => result.actualParams)
  ));
  const revisedPrompts = successfulResults.flatMap((result) => (
    result.revisedPrompts?.length
      ? result.revisedPrompts
      : result.images.map(() => undefined)
  ));
  const rawImageUrls = successfulResults.flatMap((result) => result.rawImageUrls ?? []);
  const rawResponsePayload = mergeRawResponsePayloads(successfulResults);

  return {
    images,
    actualParams: mergeActualParams(successfulResults[0]?.actualParams, { n: images.length }),
    actualParamsList,
    revisedPrompts,
    ...(rawImageUrls.length ? { rawImageUrls } : {}),
    ...(rawResponsePayload ? { rawResponsePayload } : {}),
  };
}

async function callImagesApi(options: AiImageGenerateOptions, params: AiImageTaskParams, fetchImpl: typeof fetch): Promise<AiImageGenerateResult> {
  if (options.config.codexCli && params.n > 1) {
    return callImagesApiConcurrent(options, params, fetchImpl);
  }

  return callImagesApiSingle(options, params, fetchImpl);
}

async function callResponsesApi(options: AiImageGenerateOptions, params: AiImageTaskParams, fetchImpl: typeof fetch): Promise<AiImageGenerateResult> {
  const { config } = options;
  const mime = MIME_MAP[params.output_format] || 'image/png';
  const { controller, timeoutId } = createAbortController(config.timeout);
  try {
    const tool: Record<string, unknown> = {
      type: 'image_generation',
      action: 'generate',
      size: params.size,
      output_format: params.output_format,
    };
    if (!config.codexCli) {
      tool.quality = params.quality;
    }
    if (params.output_format !== 'png' && params.output_compression != null) {
      tool.output_compression = params.output_compression;
    }
    const input = options.referenceImages?.length
      ? [{
        role: 'user',
        content: [
          { type: 'input_text', text: params.disable_prompt_optimization ? `${PROMPT_REWRITE_GUARD_PREFIX}\n${options.prompt}` : options.prompt },
          ...options.referenceImages.map((imageUrl) => ({ type: 'input_image', image_url: imageUrl })),
        ],
      }]
      : params.disable_prompt_optimization
        ? `${PROMPT_REWRITE_GUARD_PREFIX}\n${options.prompt}`
        : options.prompt;
    const response = await fetchImpl(buildApiUrl(config.baseUrl, 'responses'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({
        model: config.model,
        input,
        tools: [tool],
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response));
    }
    const result = parseResponsesImageResults(await response.json() as ResponsesApiResponse, mime);
    return {
      ...result,
      actualParams: mergeActualParams(result.actualParams, { n: result.images.length }),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function generateAiImages(options: AiImageGenerateOptions): Promise<AiImageGenerateResult> {
  const prompt = options.prompt.trim();
  if (!prompt) {
    throw new Error('请输入提示词');
  }
  if (!options.config.apiKey) {
    throw new Error('请先在 AI 设置中配置 API Key');
  }

  const params = normalizeAiImageRequestParams(options.params, options.config);
  const referenceImages = Array.isArray(options.referenceImages)
    ? options.referenceImages.filter((image): image is string => typeof image === 'string' && image.startsWith('data:image/'))
    : [];
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    return options.config.apiMode === 'responses'
      ? callResponsesApi({ ...options, prompt, referenceImages }, params, fetchImpl)
      : callImagesApi({ ...options, prompt, referenceImages }, params, fetchImpl);
  } catch (error) {
    Object.assign(error as object, getRawErrorPayload(error));
    throw error;
  }
}
