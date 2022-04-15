# ruhuka

A REST API Client.

In these days, I couldn't find a viable REST API Client for Javascript so I
created one. This is in it's initial days and may change very quickly. Inspired
by [another-rest-client](https://github.com/Amareis/another-rest-client)

## Installation

Using npm

```sh
npm install ruhuka
# or using yarn
yarn add ruhuka
```

Then import it

```js
// commonjs
const { RESTResource, Resource } = require("ruhuka");
// esm
import RESTResource, { Resource } from "ruhuka";
```

Using deno

```js
import RESTResource, { Resource } from "https://deno.land/x/ruhuka@v0.0.0/mod.ts";
```

## Usage

The library exports 2 main classes: `RESTResource` and `Resource`.
`RESTResource` is also the default export. It has some helper methods to help query
REST APIs.

### REST Resource

Importing REST Resource.

```js
// import the rest resource class
import RESTResource from "ruhuka";
import { RESTResource } from "ruhuka";
```

Initialization

```js
// initialise a new resource
const Posts = new RESTResource(
  "todos",
  "https://jsonplaceholder.typicode.com/posts",
);
```

> NOTE: all returned values are `Response`s by default, so you will have to
> parse the response yourself for example by calling `posts.json()`

#### CRUD

The CRUD (Create Read Update Delete) methods are only available on a
`RESTResource` (not the `Resource`).

1. Get all items in collection (READ)

```js
const posts = await Posts.get();
// GET https://jsonplaceholder.typicode.com/posts
```

2. Get a particular resource

```js
const post = await Posts.get_item("1");
// GET https://jsonplaceholder.typicode.com/posts/1
```

3. Creating a post

```js
await Posts.post({
  userId: 1,
  id: 101,
  title: "Test post",
  body: "easy peasy",
}, {
  encode: "json",
});
// POST https://jsonplaceholder.typicode.com/posts
// Headers content-type=json
// Body=JSON.stringify(body)
```

4. Updating a resource

```js
// using PUT
await Posts.put_item("1", {
  title: "This is changed",
}, {
  encode: "json",
});
// PUT https://jsonplaceholder.typicode.com/posts/1
// Headers content-type=json
// Body=JSON.stringify(body)

// using PATCH
await Posts.put_item("1", {
  title: "This is changed",
}, {
  encode: "json",
});
// PATCH https://jsonplaceholder.typicode.com/posts/1
// Headers content-type=json
// Body=JSON.stringify(body)
```

5. Deleting a resource

```js
await Posts.delete_item("1");
```

### Resource

Importing Resource.

```js
// import the resource class
import { Resource } from "ruhuka";
```

Initialization

```js
// initialise a new resource
const Posts = new Resource(
  "todos",
  "https://jsonplaceholder.typicode.com/posts",
);
```

Because a Resource does not provide helper methods such as `get`, `get_item`
etc. You have to initialise them yourself. Here is an example roughly based on
Ruby on Rails.

```js
Posts.create = Posts.new_method("create", "POST");
Posts.all = Posts.new_method("all", "GET");
// the third parameter means it's acting on a document rather than a collection in whole
Posts.get = Posts.new_method("get", "GET", true);
Posts.update = Posts.new_method("update", "PUT", true);
Posts.delete = Posts.new_method("delete", "DELETE", true);

// Now we can use our methods
Posts.delete("1");
```

> TIP: You can also use `new_method` on plain `Resource`. In fact, RESTResource is an extended version of Resource that calls `new_method` several times in the constructor to make it able to interact to a REST API.

#### Configuration

While initialising the resource, you can also set some options as outlined
below:

- **route**: options for the child routes (`get`,`get_item`) etc.

```js
const ConfigedResource = new Resource("name", "uri://url", {
  route: { ...options },
});
```

### Route Configuration

You can set route options per resource or per API call as shown below:

```js
// per resource
// the third paramter
const JSONAPI = new Resource("name", "uri://url", {
  route: {
    encode: "json",
    decode: "json",
    headers: {
      "content-type": "application/json",
      "authorization": "JWT somekey",
    },
  },
});

// per call
// the first parameter on collection methods
const result = JSONAPI.get({
  decode: "text",
  headers: {
    "etag": "W\\some-etag",
  },
});

// the second parameter on document methods 
const result = JSONAPI.get_item("1", {
  decode: "text",
  headers: {
    "etag": "W\\some-etag",
  },
});
```

- **encode**: `Function | "json" | null` Encode the request body before sending
  it. Can be a function that receives a body and encode it to one of the
  following types:
  `string | Blob | BufferSource | FormData | URLSearchParams | ReadableStream<Uint8Array>`.
  If it is the string `"json"`. `JSON.stringify` will be called on the body
  before sending it. By default the value is set to null and the body isn't
  encoded at all.
- **decode**: `Function | "response" | "json" | "text" | "array-buffer" | null`.
  Converts the got Response to the given type. By default it is set to
  `"response"` and therefore returns the plain `Response`.
- **fetch**: `Function` the `fetch` function to use. By default uses
  `globalThis.fetch`.
- **additionalData**: `object` additional data to send in the 2nd argument to
  `fetch`.
- **params**:
  `string | string[][] | Record<string, string> | URLSearchParams | undefined`
  Query search params to send (first argument to `URLSearchParams`).
- **mustBeOk**: `boolean` the response must be in the 200-399 range
  (successful).

## Usage examples

### Sample JSON API.

```js
import { Resource, RESTResource } from "ruhuka";

const Posts = new RESTResource(
  "todos",
  "https://jsonplaceholder.typicode.com/posts",
  {
    route: {
      encode: "json",
      decode: "json",
    },
  },
);
```

### Experimental nested documents

Gets resources attached to another resource.

```js
const Comments = Posts.document("1", "comments");

// get all comments
await Comments.get();
// get a specific comment
await Comments.get_item("1");
```

> NOTE: The nested resources are cached in case of multiple calls. The following code hence creates a single resource.

```js
const allComments = await Posts.document("1", "comments").get();
const specificComment = await Posts.document("1", "comments").get_item("1");
await Posts.document("1", "comments").delete_item(specificComment.id);
```

### TypeScript

You can add 2 parameters to `Resource` to denote the type of the (decoded) data
returned from the document and collection APIs respectively

```ts
interface IPost {
  title: string;
  body: string;
}

interface IPaginated {
  total: number;
  limit: number;
  skip: number;
  data: IPost[];
}

const Posts = new Resource<IPost, IPaginated>("posts", "uri://url", {
  route: {
    encode: "json",
    decode: "json",
  },
});
const posts: IPaginated = await Posts.get();
const post: IPost = await Posts.get("1");
```

### Error handling

The methods return promises which can catch when an issue occur (request was
aborted, network lost) or when the result doesn't have a status code (200-399 or
`response.ok === false`) and the route configuration option `mustBeOk` is set.
The package throws the original response.

```js
const Posts = new Resource("posts", "uri://url", {
  route: {
    encode: "json",
    decode: "json",
    mustBeOk: true,
  },
});

const post = await Posts.get("400042342")
  .catch(response => console.log(response.status));
  // logs 404 (there is no post with id 400042342)
```

### Caching

The package doesn't do any caching at all. But I will work on a caching fetching function. Here is an idea of how you might implement cache.

```js
// stores a map of urls and response
const cache = new Map();

// this implementation is very incomplete. It caches everything. In practice you would want to honor the cache headers `Cache-Control`, `ETag` etc. and would also compare the request options (changed headers may mean a different response.)
const cachingFetch = (url, options) => {
  // if the url is cached, return the cached response
  if (cache.has(url)) {
    return cache.get(url).clone();
  };
  // else fetch the url then cache it
  else {
    return fetch(url, options)
      .then(response => {
        // don't cache non-ok responses
        if (!response.ok) return response;
        cache.set(url, response);
        return response.clone();
      });
  }
}

const Posts = new Resource("posts", "uri://url", {
  route: {
    encode: "json",
    decode: "json",
    mustBeOk: true,
    fetch: cachingFetch
  },
});
```

### Authentication

You may be required to send some headers everytime to access protected resources. It's super easy with ruhuka:

```js
// could also be a plain object
const headers = new Headers();
headers.set("Authorization", `JWT YOUR_KEY_HERE`);

const Posts = new Resource("posts", "uri://url", {
  route: {
    encode: "json",
    decode: "json",
    headers
  },
});
```

## Contributing

Note that this is an early draft and some features are missing. However all types of pull requests are welcome.
