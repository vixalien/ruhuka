import Resource from "./resource.ts";
import Configurable from "./configurable.ts";

interface RequestInit {
	body?: Blob | BufferSource | FormData | URLSearchParams | ReadableStream;
	integrity?: string;
	keepalive?: boolean;
	window?: unknown;
	signal?: AbortSignal;
	method?: string;
	headers?: Headers;
	mode?: string;
	credentials?: 'omit' | 'same-origin' | 'include';
	cache?: 'default' | 'no-store' | 'reload' | 'no-cache' | 'force-cache' | 'only-if-cached';
	redirect?: 'follow' | 'error' | 'manual';
	referrer?: 'no-referrer' | 'client';
}

type BodyInit = string | Blob | BufferSource | FormData | URLSearchParams | ReadableStream<Uint8Array>;

function isBodyInit(body: unknown): body is BodyInit {
  // BufferSource isn't supported for now
  return typeof body === 'string' || body instanceof Blob || body instanceof FormData || body instanceof URLSearchParams || body instanceof ReadableStream;
}

export interface RouteOptions {
  encode?:
    | ((body: unknown) => BodyInit | null | undefined)
    | null
    | "json";
  decode?:
    | ((res: Response) => unknown)
    | null
    | "response"
    | "json"
    | "text"
    | "array-buffer";
  headers: Headers;
  fetch: typeof globalThis.fetch;
  additionalData: Record<string, unknown>;
  params:
    | string
    | string[][]
    | Record<string, string>
    | URLSearchParams
    | undefined;
  mustBeOk?: boolean;
}

type RouteOptionsAndId = Partial<RouteOptions> & { id?: string };

export type RequestFn<Returns> = (
  body?: unknown,
  options?: RouteOptionsAndId,
) => Promise<Returns>;

export type RequestItemFn<Returns> = (
  id: string,
  body?: unknown,
  options?: RouteOptionsAndId,
) => Promise<Returns>;

interface RouteMethods<Item, Items> {
  request: RequestFn<Items>;
  request_item: RequestItemFn<Item>;
}

export default class Route<Item = unknown, Items = unknown>
  extends Configurable<RouteOptions>
  implements RouteMethods<Item, Items> {
  host?: string;
  method: string;
  parent?: Resource;
  defaults: RouteOptions = {
    encode: null,
    decode: "response",
    headers: new Headers(),
    fetch: globalThis.fetch,
    additionalData: {},
    params: {},
    mustBeOk: false,
  };
  constructor(
    init: Resource | string,
    method: string = "GET",
    options: Partial<RouteOptions> = {},
  ) {
    super();
    this.method = method;
    options = this.set_options(options, this.defaults);
    if (init instanceof Resource) {
      this.parent = init;
    } else if (typeof init == "string") {
      this.host = init;
    } else {
      throw new TypeError(`Got init of invalid type: ${typeof init}`);
    }
  }

  url(body: unknown, options: RouteOptionsAndId = {}) {
    function isParam(body: unknown): body is typeof options.params {
      // check whether this body can be used to create a new URLSearchParams
      return typeof body == "string" || body instanceof URLSearchParams || Array.isArray(body);
    }
    let url;
    if (this.host) {
      url = this.host;
    } else if (this.parent) {
      url = this.parent.url;
    } else {
			throw new TypeError(`No host or parent found`);
		}
    if (options.id) {
      if (!url?.endsWith("/")) url += "/";
      url += options.id;
    }
    let { params } = this.parse_options(options);
    if (["get", "options"].includes(this.method.toLowerCase())) {
      // body is url
      if (body && isParam(body)) {
        params = body;
        body = undefined;
      }
    }
    const search = new URLSearchParams(params).toString();
    if (search) {
      url += "?" + search;
    }
    return url;
  }

  decode(
    response: Response,
  ): Response | Promise<string> | Promise<ArrayBuffer> | unknown {
    const { decode, mustBeOk } = this.options;
    if (mustBeOk && !response.ok) throw response;
    if (typeof decode == "string") {
      switch (decode) {
        case "response":
          return response;
        case "json":
          return response.json();
        case "text":
          return response.text();
        case "array-buffer":
          return response.arrayBuffer();
        default:
          throw new TypeError(
            `Don't know how to decode response as: ${decode}`,
          );
      }
    } else if (typeof decode == "function") {
      return decode(response);
    } else if (!decode) {
      return response;
    } else {
      throw new TypeError(`Don't know how to decode response`);
    }
  }

  properties(options: RouteOptionsAndId = {}) {
    if (this.parent) {
      const routeOptions = this.parent.options.route;
      if (typeof routeOptions != "object") return;
      return { ...this.parse_options(options), ...routeOptions };
    } else {
      return this.parse_options(options);
    }
  }

  encode_body(body?: unknown, properties: Partial<RouteOptions> = {}): BodyInit | null | undefined {
    function isIterable(body: unknown): body is Iterable<unknown[]> {
      return typeof body == "object" && typeof (body as Record<string, unknown>).next == "function";
    }
    if (!body) return null;
    const { encode, headers } = properties;
    if (!headers) throw new TypeError(`No headers provided`);
    if (["get", "options"].includes(this.method.toLowerCase())) {
      return null;
    } else if (typeof encode == "function") {
      return encode(body);
    } else if (encode == "json") {
      headers.set("Content-Type", "application/json");
      // if iterable, convert to object (useful for formdata)
      if (isIterable(body)) {
        return JSON.stringify(Object.fromEntries(body));
      }
      return JSON.stringify(body);
    } else if (!encode && isBodyInit(body)) {
      return body;
    } else {
      throw new TypeError(`Don't know how to encode request body`);
    }
  }

  request(body?: unknown, options: RouteOptionsAndId = {}): Promise<Items> {
    const properties = this.properties(options);
    if (!properties?.fetch) throw new TypeError(`No "fetch" function found`);
    const { headers, fetch, additionalData } = properties;
    const url = this.url(body, properties);
    return fetch(url, {
      method: this.method.toLowerCase(),
      body: this.encode_body(body, properties),
      headers,
      ...additionalData,
    }).then(this.decode.bind(this)) as unknown as Promise<Items>;
  }

  request_item(
    id: string,
    body?: unknown,
    options: RouteOptionsAndId = {},
  ): Promise<Item> {
    options.id = id;
    // @ts-expect-error returns one item
    return this.request(body, options);
  }
}
