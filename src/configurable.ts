/**
 * The Configurable class creates an object that can be configured using options
 * It provides 2 basic methods: `parse_options` and `set_options` and a constructor
 * that sets the given inital partial options using the given defaults
 *
 * This class is to be extended.
 * @param {object} T - The type of options
 * @example
 * interface Options {
 * 	cool: boolean;
 * }
 * const defaultOptions: Options = {
 *  cool: true,
 * }
 * class AmICool {
 *  constructor(options: Options) {
 *    super(options, defaultOptions)
 *  }
 *  amICool() {
 *    return this.options.cool;
 *  }
 * }
 */
export default class Configurable<T> {
  options: Partial<T>;
  /**
   * Merges the given `options` with `defaults` or current options (`this.options`)
   * Useful for temporarily overriding options
   * @param options The given options
   * @param defaultOptions The default options
   * @returns The parsed options
   */
  parse_options(options?: Partial<T>, defaultOptions?: Partial<T>) {
    const currentOptions = defaultOptions || this.options || {};

    options = Object.assign(currentOptions, options);

    return Object.assign({}, options);
  }

  /**
   * Merges the given `options` with `defaults` and set them as `this.options`
   * Overrides previously set options
   * @param options The given options
   * @param defaultOptions The default options
   * @returns The parsed options
   */
  set_options(options?: Partial<T>, defaultOptions?: Partial<T>) {
    const currentOptions = defaultOptions || {};

    this.options = Object.assign(currentOptions, options);

    return Object.assign({}, this.options);
  }

  /**
   * Merges the given `options` with `defaults` and set them as `this.options`
   * @param options The initial options
   * @param defaultOptions The default options
   */
  constructor(options?: Partial<T>, defaultOptions?: Partial<T>) {
    const currentOptions = defaultOptions || {};

    this.options = Object.assign(currentOptions, options);
  }
}
