class Configurable<T> {
	options: Partial<T>;
	parse_options(options?: Partial<T>, defaultOptions?: Partial<T>) {
		let currentOptions = defaultOptions || this.options || {};

		options = Object.assign(currentOptions, options);

		return Object.assign({}, options);
	}

	set_options(options?: Partial<T>, defaultOptions?: Partial<T>) {
		let currentOptions = defaultOptions || {};

		this.options = Object.assign(currentOptions, options);

		return Object.assign({}, this.options);
	}

	constructor(options?: Partial<T>, defaultOptions?: Partial<T>) {
		let currentOptions = defaultOptions || {};

		this.options = Object.assign(currentOptions, options);
	}
}

interface RouteOptions {
	encode?: Function | null | 'json',
	decode?: Function | null | 'response' | 'json' | 'text' | 'array-buffer',
	headers: Headers,
	fetch: Function,
	additionalData: object,
	params: string | string[][] | Record<string, string> | URLSearchParams | undefined,
	mustBeOk?: boolean,
};

type RouteOptionsAndId = Partial<RouteOptions> & { id?: string };

type RequestFn<Returns> = (body?: any, options?: RouteOptionsAndId) => Promise<Returns>;
type RequestItemFn<Returns> = (id: string, body?: any, options?: RouteOptionsAndId) => Promise<Returns>;

interface RouteMethods<Item, Items> {
	request: RequestFn<Items>;
	request_item: RequestFn<Item>;
}

class Route<Item = any, Items = any> extends Configurable<RouteOptions> implements RouteMethods<Item, Items> {
	host?: string;
	method: string;
	parent?: Resource;
	defaults: RouteOptions = {
		encode: null,
		decode: 'response',
		headers: new Headers(),
		fetch: globalThis.fetch,
		additionalData: {},
		params: {},
		mustBeOk: false,
	};
	constructor(init: Resource | string, method: string = 'GET', options: Partial<RouteOptions> = {}) {
		super();
		this.method = method;
		options = this.set_options(options, this.defaults);
		if (init instanceof Resource) {
			this.parent = init;
		} else if (typeof init == 'string') {
			this.host = init;
		} else {
			throw new TypeError(`Got init of invalid type: ${typeof init}`);
		}
	}

	url(body: any, options: RouteOptionsAndId = {}) {
		let url;
		if (this.host) {
			url = this.host;
		} else if (this.parent) {
			url = this.parent.url;
		}
		if (options.id) {
			if (!url?.endsWith("/")) url += "/";
			url += options.id;
		}
		let { params } = this.parse_options(options);
		if (["get", "options"].includes(this.method.toLowerCase())) {
			// body is url
			if (body) {
				params = body;
				body = null;
			}
		}
		let search = new URLSearchParams(params).toString();
		if (search) {
			url += '?' + search;
		}
		return url;

	}

	decode(response: Response): Response | Promise<string> | Promise<ArrayBuffer> | any {
		const { decode, mustBeOk } = this.options;
		if (mustBeOk && !response.ok) throw response;
		if (typeof decode == 'string') {
			switch (decode) {
				case 'response':
					return response;
				case "json":
					return response.json();
				case 'text':
					return response.text();
				case 'array-buffer':
					return response.arrayBuffer();
				default:
					throw new TypeError(`Don't know how to decode response as: ${decode}`);
			}
		} else if (typeof decode == 'function') {
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
			if (typeof routeOptions != 'object') return;
			return { ...this.parse_options(options), ...routeOptions };
		} else {
			return this.parse_options(options);
		}
	}

	encode_body(body?: any, properties: Partial<RouteOptions> = {}) {
		if (!body) return null;
		const { encode, headers } = properties;
		if (!headers) throw new TypeError(`No headers provided`);
		if (["get", "options"].includes(this.method.toLowerCase())) {
			return null;
		} else if (typeof encode == 'function') {
			return encode(body);
		} else if (encode == 'json') {
			headers.set('Content-Type', 'application/json');
			// if iterable, convert to object (useful for formdata)
			if (Symbol.iterator in body) {
				return JSON.stringify(Object.fromEntries(body));
			}
			return JSON.stringify(body);
		} else if (!encode) {
			return body;
		} else {
			throw new TypeError(`Don't know how to encode request body`);
		}
	}

	request(body?: any, options: RouteOptionsAndId = {}): Promise<Items> {
		const properties = this.properties(options);
		if (!properties?.fetch) throw new TypeError(`No "fetch" function found`);
		const { headers, fetch, additionalData } = properties;
		const url = this.url(body, properties);
		return fetch(url, {
			method: this.method.toLowerCase(),
			body: this.encode_body(body, properties),
			headers,
			...additionalData,
		}).then(this.decode.bind(this))
	}

	request_item(id: string, body?: any, options: RouteOptionsAndId = {}): Promise<Item> {
		options.id = id;
		// @ts-expect-error returns one item
		return this.request(body, options);
	}
}

type ShortcutFn = (key: string) => string;
type ResourceInitOptions<Item, Items> = Partial<ResourceOptions<Item, Items>> & { init?: any };
type CollectionInitOptions<Item, Items> = string | { name: string, options?: ResourceInitOptions<Item, Items> };

interface Methods<Item, Items> {
	[key: string]: RequestFn<Items> | RequestItemFn<Item>;
}

interface ResourceOptions<Item, Items = any> {
	_document: boolean,
	_collection: boolean,
	_shortcuts: boolean,
	_shortcut_rules?: ShortcutFn | ShortcutFn[] | string[] | string,
	_init_shortcuts?: Record<string, Resource | Route<Item, Items>>,
	name: string,
	route: Partial<RouteOptions>,
	rest: boolean,
}

class Resource<Item = any, Items = any> extends Configurable<ResourceOptions<Item, Items>> implements Methods<Item, Items> {
	[key: string]: any;
	name: string;
	parent?: Resource;
	host?: string;
	_shortcuts: Record<string, Resource | Route<Item, Items>>;
	defaults: ResourceOptions<Item, Items> = {
		_document: true,
		_collection: true,
		_shortcuts: true,
		_shortcut_rules: [],
		name: "resource",
		route: {},
		rest: true,
	}
	constructor(name: string, init: Resource | string, options: Partial<ResourceOptions<Item, Items>> = {}) {
		super();
		options = this.set_options(options,
			this.defaults,
		);
		// set parent
		this.name = name;
		if (options._init_shortcuts) {
			this._shortcuts = options._init_shortcuts;
		} else {
			this._shortcuts = {};
		}
		if (init instanceof Resource) {
			this.parent = init;
		} else if (typeof init == 'string') {
			this.host = init;
		} else {
			throw new TypeError(`Got init of invalid type: ${typeof init}`);
		}
	}

	_get_shortcut(name: string) {
		if (name in this._shortcuts)
			return this._shortcuts[name];
	}

	_add_shortcut(name: string, value: Resource | Route<Item, Items> | ((name: string, options: Partial<ResourceOptions<Item, Items>>) => Resource | Route<Item, Items>), options: Partial<ResourceOptions<Item, Items>> = {}) {
		let { _shortcuts, _shortcut_rules } = this.parse_options(options);

		let saved_member = this._get_shortcut(name);
		if (saved_member) return saved_member;

		// if object is a function, exec it
		const object = typeof value == 'function' ? value(name, options) : value;
		this._shortcuts[name] = object;
		if (_shortcuts) {
			const rules = [_shortcut_rules].flat();
			// use custom rules
			if (rules && rules.length > 0) {
				rules.forEach(rule => {
					if (!rule) return;
					const customName = (typeof rule == "function") ? rule(name) : rule.toString();
					if (customName && typeof customName == "string") {
						this._shortcuts[customName] = object;
						this[customName] = object;
					}
				})
			} else {
				// use normal rule
				this[name] = object;
			}

		}

		return object;
	}

	get url(): string {
		if (this.host) {
			return this.host;
		} else if (this.parent && this.name) {
			return (new URL(this.name, this.parent.url)).toString();
		} else {
			throw new Error(`Couldn't generate URL for "${this.name}". Please set the "name" and either the "host" or "parent" property`);
		}
	}

	new_method<Method = Function>(name: string, method: string, has_id: boolean = false): Method {
		let method_req;
		const route = new Route<Item, Items>(this, method, { ...this.options.route });
		if (has_id) {
			method_req = route.request_item.bind(route);
		} else {
			method_req = route.request.bind(route);
		}
		this._add_shortcut(name, () => {
			return route;
		}, { _shortcuts: false });
		// @ts-expect-error trust this will be of type Method
		return method_req;
	}

	collection<CItem = any, CItems = any>(name: string, options: ResourceInitOptions<Item, Items> = {}): Resource<CItem, CItems> {
		options = this.parse_options(options);
		// @ts-expect-error will return Resource
		return this._add_shortcut(name, () => new Resource<CItem, CItems>(name, options.init || this, options));
	}

	collections(array: CollectionInitOptions<Item, Items> | CollectionInitOptions<Item, Items>[]) {
		array = [array].flat();
		return array.map(item => {
			if (typeof item == "string") {
				return this.collection(item);
			} else {
				return this.collection(item.name, item.options);
			}
		})
	}
}

interface RESTResourceOptions<Item, Items> extends ResourceOptions<Item, Items> {
	rest: boolean;
}

class RESTResource<Item = any, Items = any> extends Resource<Item, Items> {
	options!: RESTResourceOptions<Item, Items>;

	post: RequestFn<Items>;
	get: RequestFn<Items>;
	get_item: RequestItemFn<Item>;
	put_item: RequestItemFn<Item>;
	patch_item: RequestItemFn<Item>;
	delete_item: RequestItemFn<Item>;

	constructor(name: string, init: Resource | string, options: Partial<ResourceOptions<Item, Items>> = {}) {
		super(name, init, options);

		this.get_item = this.new_method("get_item", "GET", true);
		this.put_item = this.new_method("put_item", "GET", true);
		this.patch_item = this.new_method("patch_item", "GET", true);
		this.delete_item = this.new_method("delete_item", "GET", true);
		this.post = this.new_method("post", "POST");
		this.get = this.new_method("get", "GET");
	}
}

export { RESTResource, Resource, Route, Configurable };
export type { ResourceOptions, RouteOptions, Methods };
export default RESTResource;