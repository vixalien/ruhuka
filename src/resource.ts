// deno-lint-ignore-file no-explicit-any
import Configurable from "./configurable.ts";
import Route from "./route.ts";
import type { RequestFn, RequestItemFn, RouteOptions } from "./route.ts";

type ShortcutFn = (key: string) => string;
type ResourceInitOptions<Item, Items> =
  & Partial<ResourceOptions<Item, Items>>
  & { init?: any };
type CollectionInitOptions<Item, Items> = string | {
  name: string;
  options?: ResourceInitOptions<Item, Items>;
};

export interface Methods<Item, Items> {
  [key: string]: RequestFn<Items> | RequestItemFn<Item>;
}

export interface ResourceOptions<Item, Items = any> {
  _document: boolean;
  _collection: boolean;
  _shortcuts: boolean;
  _shortcut_rules?: ShortcutFn | ShortcutFn[] | string[] | string;
  _init_shortcuts?: Record<string, Resource | Route<Item, Items>>;
  name: string;
  route: Partial<RouteOptions>;
  rest: boolean;
}

export default class Resource<Item = any, Items = any>
  extends Configurable<ResourceOptions<Item, Items>>
  implements Methods<Item, Items> {
  [key: string]: any
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
  };
  constructor(
    name: string,
    init: Resource | string,
    options: Partial<ResourceOptions<Item, Items>> = {},
  ) {
    super();
    options = this.set_options(options, this.defaults);
    // set parent
    this.name = name;
    if (options._init_shortcuts) {
      this._shortcuts = options._init_shortcuts;
    } else {
      this._shortcuts = {};
    }
    if (init instanceof Resource) {
      this.parent = init;
    } else if (typeof init == "string") {
      this.host = init;
    } else {
      throw new TypeError(`Got init of invalid type: ${typeof init}`);
    }
  }

  _get_shortcut(name: string) {
    if (name in this._shortcuts) {
      return this._shortcuts[name];
    }
  }

  _add_shortcut(
    name: string,
    value:
      | Resource
      | Route<Item, Items>
      | ((
        name: string,
        options: Partial<ResourceOptions<Item, Items>>,
      ) => Resource | Route<Item, Items>),
    options: Partial<ResourceOptions<Item, Items>> = {},
  ) {
    const { _shortcuts, _shortcut_rules } = this.parse_options(options);

    const saved_member = this._get_shortcut(name);
    if (saved_member) return saved_member;

    // if object is a function, exec it
    const object = typeof value == "function" ? value(name, options) : value;
    this._shortcuts[name] = object;
    if (_shortcuts) {
      const rules = [_shortcut_rules].flat();
      // use custom rules
      if (rules && rules.length > 0) {
        rules.forEach((rule) => {
          if (!rule) return;
          const customName = (typeof rule == "function")
            ? rule(name)
            : rule.toString();
          if (customName && typeof customName == "string") {
            this._shortcuts[customName] = object;
            this[customName] = object;
          }
        });
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
      throw new Error(
        `Couldn't generate URL for "${this.name}". Please set the "name" and either the "host" or "parent" property`,
      );
    }
  }

  new_method<Method = () => any>(
    name: string,
    method: string,
    has_id = false,
  ): Method {
    let method_req;
    const route = new Route<Item, Items>(this, method, {
      ...this.options.route,
    });
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

  collection<CItem = Item, CItems = Items>(
    name: string,
    options: ResourceInitOptions<Item, Items> = {},
  ): Resource<CItem, CItems> {
    const resource_options = removeAttribute<ResourceOptions<CItem, CItems>>(this.parse_options(options), "init");
    // @ts-expect-error will return Resource
    return this._add_shortcut(
      name,
      () => new Resource<CItem, CItems>(name, options.init || this, resource_options),
    );
  }

  collections(
    array: CollectionInitOptions<Item, Items> | CollectionInitOptions<
      Item,
      Items
    >[],
  ) {
    array = [array].flat();
    return array.map((item) => {
      if (typeof item == "string") {
        return this.collection(item);
      } else {
        return this.collection(item.name, item.options);
      }
    });
  }
}

function removeAttribute<Type> (object: Record<string, any>, attribute: string): Type {
  return Object.fromEntries(Object.entries(object).filter(([key]) => {
    return key !== attribute;
  })) as unknown as Type;
}
