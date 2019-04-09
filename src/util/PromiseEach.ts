import throwAll from "./throwAll";
import Tuple from "./Tuple";
import { ErrorBuffer } from "./errors";

/**
 * Same as `Promise.all`, except:
 *
 * 1. The returned `Promise` resolves or rejects only after *all* of the provided `Promise`s resolve or reject.
 * 2. If more than one of the provided `Promise`s reject, the returned promise rejects with an array containing *all* of the rejection reasons.
 *
 * @param ctor - Which `Promise` implementation to use. Defaults to the native implementation.
 */
async function PromiseEach<Ps extends Tuple<PromiseLike<any> | any>>(promises: Ps, ctor?: PromiseConstructor): Promise<{ [K in keyof Ps]: Ps[K] extends PromiseLike<infer T> ? T : Ps[K] }>;

async function PromiseEach(promises: any, ctor: PromiseConstructor = Promise): Promise<any> {
	const results: any[] = await ctor.all(
		promises.map((promise: Promise<any> | any) =>
			promise instanceof ctor
				? promise.then(
					(resolved: any) => ({ resolved }),
					(rejected: any) => ({ rejected })
				)
				: promise
		)
	);

	const rejections = new ErrorBuffer();

	for (const result of results)
	if ("rejected" in result)
		rejections.add(result.rejected);

	rejections.check();
	return results.map(t => t.resolved);
}

export default PromiseEach;
