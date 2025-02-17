import {
	createExecutionContext,
	env,
	fetchMock,
	listDurableObjectIds,
	runDurableObjectAlarm,
	runInDurableObject,
	SELF,
	waitOnExecutionContext,
} from "cloudflare:test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import worker, { Counter, transformResponse } from "./worker";

beforeAll(() => {
	fetchMock.activate();
	fetchMock.disableNetConnect();
	fetchMock
		.get("https://example.com")
		.intercept({ path: "/" })
		.reply(200, "data");
});
afterAll(() => fetchMock.assertNoPendingInterceptors());

describe("kv", () => {
	console.log("Defining tests..."); // Check log out of test has correct stack

	it("user agents", () => {
		console.log({ env });
		expect(navigator.userAgent).toBe("Cloudflare-Workers");
	});

	it("stores in KV", async () => {
		await env.TEST_NAMESPACE.put("key", "value");
		expect(await env.TEST_NAMESPACE.get("key")).toBe("value");
	});

	it("uses seeded data", async () => {
		const seed = await env.SEED_NURSERY.fetch("http://placeholder/seed.txt");
		expect(seed.status).toBe(200);
		await env.TEST_NAMESPACE.put("seeded", (await seed.text()).trim());
		expect(await env.TEST_NAMESPACE.get("seeded")).toBe("🌱");
	});

	it("stores in Durable Objects", async () => {
		const id = env.COUNTER.idFromName("a");
		const stub = env.COUNTER.get(id);
		let response = await stub.fetch("http://x/abc");
		expect(await response.json()).toMatchObject({ value: 1 });
		response = await stub.fetch("http://x/abc");
		expect(await response.json()).toMatchObject({ value: 2 });

		const ids = await listDurableObjectIds(env.COUNTER);
		expect(ids.length).toBe(1);
		expect(ids[0].equals(id)).toBe(true);
	});
	it("stores in Durable Object instances", async () => {
		const ids = await listDurableObjectIds(env.COUNTER);
		expect(ids.length).toBe(0); // Isolation!

		const id = env.COUNTER.idFromName("a");
		const stub = env.COUNTER.get(id);

		let response = await stub.fetch("http://x");
		expect(await response.json()).toMatchObject({ value: 1 }); // Isolation!
		response = await runInDurableObject(stub, (instance: Counter) => {
			expect(instance).toBeInstanceOf(Counter);
			return instance.fetch(new Request("http://x"));
		});
		expect(await response.json()).toMatchObject({ value: 2 });

		const value = await runInDurableObject(stub, (_instance, state) =>
			state.storage.get<number>("/")
		);
		expect(value).toBe(2);

		response = await runInDurableObject(stub, (instance) =>
			instance.fetch(new Request("http://x"))
		);
		expect(await response.json()).toMatchObject({ value: 3 });
	});

	it("calls Durable Object alarm", async () => {
		const id = env.COUNTER.idFromName("alarm-test");
		const stub = env.COUNTER.get(id);
		await runInDurableObject(stub, async (_instance, state) => {
			await state.storage.setAlarm(Date.now() + 10_000);
		});
		expect(await runDurableObjectAlarm(stub)).toBe(true);
		const alarmResult = await runInDurableObject(
			stub,
			(instance: Counter) => instance.alarmPromise
		);
		expect(alarmResult).toBe(42);
		expect(await runDurableObjectAlarm(stub)).toBe(false);
	});

	it("uses other object", async () => {
		const id = env.OTHER.idFromName("other-test");
		const stub = env.OTHER.get(id);
		const response = await stub.fetch("http://x");
		expect(await response.text()).toBe("other Durable Object body");
		// Can only use Durable Object runner helpers for same-isolate objects
		await expect(runInDurableObject(stub, () => {})).rejects.toThrow();

		const ids = await listDurableObjectIds(env.OTHER);
		expect(ids.length).toBe(1);
		expect(ids[0].equals(id)).toBe(true);
	});

	it("fetches", async () => {
		const request = new Request<unknown, IncomingRequestCfProperties>(
			"http://localhost"
		);
		const ctx = createExecutionContext();
		// @ts-expect-error `fetch()` is defined, but optional on `ExportedHandler`.
		//  The solution is to use `satisfies ExportedHandler` here instead, but
		//  we're stuck on an old TypeScript version until we bump to Prettier 3.
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(await response.text()).toBe("body:http://localhost");
	});

	it("transforms", async () => {
		const response = transformResponse(
			new Response('<a href="http://example.com"></a>')
		);
		expect(await response.text()).toBe('<a href="https://example.com"></a>');
	});

	it("sends request to self", async () => {
		const res = await SELF.fetch("http://localhost");
		expect(await res.text()).toMatchInlineSnapshot(`"body:http://localhost"`);
	});

	it("mocks fetch requests", async () => {
		const res = await fetch("https://example.com");
		expect(await res.text()).toMatchSnapshot("mocked-data");
	});
});
