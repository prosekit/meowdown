import { HostElement, State } from "@aria-ui/core";
/**
 * Loads the snapshot for `url`. Return `undefined` when nothing was found.
 */
type Resolver<T> = (url: string) => T | undefined | PromiseLike<T | undefined>;
interface FetchProps<T> {
  /**
   * A saved snapshot. When set, it is rendered as is and `url` is not fetched.
   */
  data: T | null;
  /**
   * The URL to pass to `resolver` when `data` is `null`.
   */
  url: string | null;
  /**
   * Called with `url` to load the snapshot when `data` is `null`.
   */
  resolver: Resolver<T> | null;
}
export { Resolver as n, FetchProps as t };