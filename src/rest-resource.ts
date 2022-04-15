import Resource from "./resource.ts";
import type { ResourceOptions } from "./resource.ts";
import type { RequestFn, RequestItemFn } from "./route.ts";

interface RESTResourceOptions<Item, Items>
  extends ResourceOptions<Item, Items> {
  rest: boolean;
}

export default class RESTResource<Item = unknown, Items = unknown>
  extends Resource<Item, Items> {
  // making deno happy
  // options!: RESTResourceOptions<Item, Items>;

  post: RequestFn<Items>;
  get: RequestFn<Items>;
  get_item: RequestItemFn<Item>;
  put_item: RequestItemFn<Item>;
  patch_item: RequestItemFn<Item>;
  delete_item: RequestItemFn<Item>;

  constructor(
    name: string,
    init: Resource | string,
    options: Partial<ResourceOptions<Item, Items>> = {},
  ) {
    super(name, init, options);

    this.get_item = this.new_method("get_item", "GET", true);
    this.put_item = this.new_method("put_item", "PUT", true);
    this.patch_item = this.new_method("patch_item", "PATCH", true);
    this.delete_item = this.new_method("delete_item", "DELETE", true);
    this.post = this.new_method("post", "POST");
    this.get = this.new_method("get", "GET");
  }
}
