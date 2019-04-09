/**
 * The type of a tuple or array.
 *
 * `Tuple<T>` is mostly equivalent to `T[]`, except that it causes TypeScript to infer tuple types where possible. For example, consider the function:
 *
 * ```typescript
 * function f<T extends any[]>(x: T): T {
 * 	return x
 * }
 *
 * let xs = f([1, 'two', null])
 * ```
 *
 * The inferred type of `xs` will be `(number | string | null)[]`. Even though the function returns the exact same array it's given, the return type doesn't make any guarantees about which items will be in the array or in which order.
 *
 * If, on the other hand, you use `Tuple`:
 *
 * ```typescript
 * function f<T extends Tuple<any>>(x: T): T {
 * 	return x
 * }
 *
 * let xs = f([1, 'two', null])
 * ```
 *
 * Now the type of `xs` will be `[number, string, null]`.
 */
type Tuple<T = any> = [T] | T[];
export default Tuple;
