export interface FindFreePortOptions {
  /** Address probed for reachability. Defaults to loopback, which is what `localhost` resolves to. */
  host?: string;
  /** How many consecutive ports to try before giving up. */
  attempts?: number;
  /** Human name used in the error message. */
  label?: string;
}

/**
 * First port at or after `preferred` that a client can actually reach on
 * `options.host`.
 *
 * Probing whether the port can be *bound* is not equivalent: binding
 * `0.0.0.0:P` succeeds on Windows even when `127.0.0.1:P` is taken by another
 * process, so a bind probe reports "free" for a port that `localhost` cannot
 * reach.
 */
export declare const findFreePort: (
  preferred: number,
  options?: FindFreePortOptions
) => Promise<number>;