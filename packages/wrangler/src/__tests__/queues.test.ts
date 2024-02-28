import { rest } from "msw";
import { mockAccountId, mockApiToken } from "./helpers/mock-account-id";
import { mockConsoleMethods } from "./helpers/mock-console";
import { clearDialogs } from "./helpers/mock-dialogs";
import { useMockIsTTY } from "./helpers/mock-istty";
import { msw } from "./helpers/msw";
import { runInTempDir } from "./helpers/run-in-tmp";
import { runWrangler } from "./helpers/run-wrangler";
import type {
	PostConsumerBody,
	PostTypedConsumerBody,
	QueueResponse,
} from "../queues/client";

describe("wrangler", () => {
	mockAccountId();
	mockApiToken();
	runInTempDir();
	const std = mockConsoleMethods();

	const { setIsTTY } = useMockIsTTY();
	beforeEach(() => {
		setIsTTY(true);
	});
	afterEach(() => {
		clearDialogs();
	});

	describe("queues", () => {
		it("should show the correct help text", async () => {
			await runWrangler("queues --help");
			expect(std.err).toMatchInlineSnapshot(`""`);
			expect(std.out).toMatchInlineSnapshot(`
			"wrangler queues

			🇶 Configure Workers Queues

			Commands:
			  wrangler queues list           List Queues
			  wrangler queues create <name>  Create a Queue
			  wrangler queues delete <name>  Delete a Queue
			  wrangler queues consumer       Configure Queue Consumers

			Flags:
			  -j, --experimental-json-config  Experimental: Support wrangler.json  [boolean]
			  -c, --config                    Path to .toml configuration file  [string]
			  -e, --env                       Environment to use for operations and .env files  [string]
			  -h, --help                      Show help  [boolean]
			  -v, --version                   Show version number  [boolean]"
		`);
		});

		describe("list", () => {
			function mockListRequest(queues: QueueResponse[], page: number) {
				const requests = { count: 0 };
				msw.use(
					rest.get(
						"*/accounts/:accountId/workers/queues?*",
						async (request, response, context) => {
							requests.count += 1;
							const query = request.url.searchParams;
							expect(Number(query.get("page"))).toEqual(page);
							expect(await request.text()).toEqual("");
							return response.once(
								context.json({
									success: true,
									errors: [],
									messages: [],
									result: queues,
								})
							);
						}
					)
				);
				return requests;
			}

			it("should show the correct help text", async () => {
				await runWrangler("queues list --help");
				expect(std.err).toMatchInlineSnapshot(`""`);
				expect(std.out).toMatchInlineSnapshot(`
			"wrangler queues list

			List Queues

			Flags:
			  -j, --experimental-json-config  Experimental: Support wrangler.json  [boolean]
			  -c, --config                    Path to .toml configuration file  [string]
			  -e, --env                       Environment to use for operations and .env files  [string]
			  -h, --help                      Show help  [boolean]
			  -v, --version                   Show version number  [boolean]

			Options:
			      --page  Page number for pagination  [number]"
		`);
			});

			it("should list queues on page 1 with no --page", async () => {
				const expectedQueues: QueueResponse[] = [
					{
						queue_id: "5e1b9969eb974d8c99c48d19df104c7a",
						queue_name: "queue-1",
						created_on: "01-01-2001",
						modified_on: "01-01-2001",
						producers: [],
						producers_total_count: 0,
						consumers: [],
						consumers_total_count: 0,
						settings: {
							delivery_delay: 0
						}
					},
					{
						queue_id: "def19fa3787741579c9088eb850474af",
						queue_name: "queue-2",
						created_on: "01-01-2001",
						modified_on: "01-01-2001",
						producers: [],
						producers_total_count: 0,
						consumers: [],
						consumers_total_count: 0,
						settings: {
							delivery_delay: 0
						}
					},
				];
				const expectedPage = 1;
				mockListRequest(expectedQueues, expectedPage);
				await runWrangler("queues list");

				expect(std.err).toMatchInlineSnapshot(`""`);
				expect(std.out).toMatchInlineSnapshot(`
			"┌──────────────────────────────────┬─────────┬────────────┬─────────────┬───────────┬───────────┐
			│ id                               │ name    │ created_on │ modified_on │ producers │ consumers │
			├──────────────────────────────────┼─────────┼────────────┼─────────────┼───────────┼───────────┤
			│ 5e1b9969eb974d8c99c48d19df104c7a │ queue-1 │ 01-01-2001 │ 01-01-2001  │ 0         │ 0         │
			├──────────────────────────────────┼─────────┼────────────┼─────────────┼───────────┼───────────┤
			│ def19fa3787741579c9088eb850474af │ queue-2 │ 01-01-2001 │ 01-01-2001  │ 0         │ 0         │
			└──────────────────────────────────┴─────────┴────────────┴─────────────┴───────────┴───────────┘"
		`);
			});

			it("should list queues using --page=2", async () => {
				const expectedQueues: QueueResponse[] = [
					{
						queue_id: "7f7c2df28cee49ad-bbb46c9e5426e850",
						queue_name: "queue-100",
						created_on: "01-01-2001",
						modified_on: "01-01-2001",
						producers: [],
						producers_total_count: 0,
						consumers: [],
						consumers_total_count: 0,
						settings: {
							delivery_delay: 0
						}
					},
				];
				const expectedPage = 2;
				mockListRequest(expectedQueues, expectedPage);
				await runWrangler("queues list --page=2");

				expect(std.err).toMatchInlineSnapshot(`""`);
				expect(std.out).toMatchInlineSnapshot(`
			"┌───────────────────────────────────┬───────────┬────────────┬─────────────┬───────────┬───────────┐
			│ id                                │ name      │ created_on │ modified_on │ producers │ consumers │
			├───────────────────────────────────┼───────────┼────────────┼─────────────┼───────────┼───────────┤
			│ 7f7c2df28cee49ad-bbb46c9e5426e850 │ queue-100 │ 01-01-2001 │ 01-01-2001  │ 0         │ 0         │
			└───────────────────────────────────┴───────────┴────────────┴─────────────┴───────────┴───────────┘"
		`);
			});
		});

		describe("create", () => {
			function mockCreateRequest(
				expectedQueueName: string,
				queueSettings: { delivery_delay?: number } | undefined = undefined
			) {
				const requests = { count: 0 };

				msw.use(
					rest.post(
						"*/accounts/:accountId/workers/queues",
						async (request, response, context) => {
							requests.count += 1;

							const body = (await request.json()) as {
								queue_name: string;
								settings: {
									delivery_delay: number;
								};
							};
							expect(body.queue_name).toEqual(expectedQueueName);
							expect(body.settings).toEqual(queueSettings);
							return response.once(
								context.json({
									success: true,
									errors: [],
									messages: [],
									result: {
										queue_name: expectedQueueName,
										created_on: "01-01-2001",
										modified_on: "01-01-2001",
									},
								})
							);
						}
					)
				);
				return requests;
			}

			it("should show the correct help text", async () => {
				await runWrangler("queues create --help");
				expect(std.err).toMatchInlineSnapshot(`""`);
				expect(std.out).toMatchInlineSnapshot(`
			"wrangler queues create <name>

			Create a Queue

			Positionals:
			  name  The name of the queue  [string] [required]

			Flags:
			  -j, --experimental-json-config  Experimental: Support wrangler.json  [boolean]
			  -c, --config                    Path to .toml configuration file  [string]
			  -e, --env                       Environment to use for operations and .env files  [string]
			  -h, --help                      Show help  [boolean]
			  -v, --version                   Show version number  [boolean]

			Options:
			      --delivery-delay  How long a published messages should be delayed for, in seconds. Must be a positive integer  [number]"
		`);
			});

			it("should create a queue", async () => {
				const requests = mockCreateRequest("testQueue");
				await runWrangler("queues create testQueue");
				expect(std.out).toMatchInlineSnapshot(`
					"Creating queue testQueue.
					Created queue testQueue."
			  `);
				expect(requests.count).toEqual(1);
			});

			it("should show link to dash when not enabled", async () => {
				const queueName = "testQueue";
				msw.use(
					rest.post(
						"*/accounts/:accountId/workers/queues",
						async (request, response, context) => {
							expect(request.params.accountId).toEqual("some-account-id");
							return response.once(
								context.status(403),
								context.json({
									success: false,
									errors: [
										{ message: "workers.api.error.unauthorized", code: 10023 },
									],
									messages: [],
								})
							);
						}
					)
				);

				await expect(
					runWrangler(`queues create ${queueName}`)
				).rejects.toThrowError();
				expect(std.out).toMatchInlineSnapshot(`
			"Creating queue testQueue.
			Queues is not currently enabled on this account. Go to https://dash.cloudflare.com/some-account-id/workers/queues to enable it.

			[31mX [41;31m[[41;97mERROR[41;31m][0m [1mA request to the Cloudflare API (/accounts/some-account-id/workers/queues) failed.[0m

			  workers.api.error.unauthorized [code: 10023]

			  If you think this is a bug, please open an issue at:
			  [4mhttps://github.com/cloudflare/workers-sdk/issues/new/choose[0m

			"
		`);
			});

			it("should send send queue settings with delivery delay", async () => {
				const requests = mockCreateRequest("testQueue", { delivery_delay: 10 });
				await runWrangler("queues create testQueue --delivery-delay=10");
				expect(std.out).toMatchInlineSnapshot(`
					"Creating queue testQueue.
					Created queue testQueue."
			  `);
				expect(requests.count).toEqual(1);
			});

			it("should show an error when two delivery delays are set", async () => {
				const requests = mockCreateRequest("testQueue", { delivery_delay: 0 });

				await expect(
					runWrangler(
						"queues create testQueue --delivery-delay=5 --delivery-delay=10"
					)
				).rejects.toThrowErrorMatchingInlineSnapshot(
					`"Error: can't use more than a delay setting."`
				);

				expect(requests.count).toEqual(0);
			});
		});

		describe("delete", () => {
			function mockDeleteRequest(expectedQueueName: string) {
				const requests = { count: 0 };
				msw.use(
					rest.delete(
						"*/accounts/:accountId/workers/queues/:queueName",
						async (request, response, context) => {
							requests.count += 1;
							expect(request.params.queueName).toEqual(expectedQueueName);
							expect(request.params.accountId).toEqual("some-account-id");
							return response.once(
								context.json({
									success: true,
									errors: [],
									messages: [],
									result: {},
								})
							);
						}
					)
				);
				return requests;
			}

			it("should show the correct help text", async () => {
				await runWrangler("queues delete --help");
				expect(std.err).toMatchInlineSnapshot(`""`);
				expect(std.out).toMatchInlineSnapshot(`
			"wrangler queues delete <name>

			Delete a Queue

			Positionals:
			  name  The name of the queue  [string] [required]

			Flags:
			  -j, --experimental-json-config  Experimental: Support wrangler.json  [boolean]
			  -c, --config                    Path to .toml configuration file  [string]
			  -e, --env                       Environment to use for operations and .env files  [string]
			  -h, --help                      Show help  [boolean]
			  -v, --version                   Show version number  [boolean]"
		`);
			});

			it("should delete a queue", async () => {
				const requests = mockDeleteRequest("testQueue");
				await runWrangler("queues delete testQueue");
				expect(std.out).toMatchInlineSnapshot(`
					"Deleting queue testQueue.
					Deleted queue testQueue."
			  `);
				expect(requests.count).toEqual(1);
			});
		});

		describe("consumers", () => {
			it("should show the correct help text", async () => {
				await runWrangler("queues consumer --help");

				expect(std.err).toMatchInlineSnapshot(`""`);
				expect(std.out).toMatchInlineSnapshot(`
			"wrangler queues consumer

			Configure Queue Consumers

			Commands:
			  wrangler queues consumer add <queue-name> <script-name>     Add a Queue Worker Consumer
			  wrangler queues consumer remove <queue-name> <script-name>  Remove a Queue Worker Consumer
			  wrangler queues consumer http                               Configure Queue HTTP Pull Consumers
			  wrangler queues consumer worker                             Configure Queue Worker Consumers

			Flags:
			  -j, --experimental-json-config  Experimental: Support wrangler.json  [boolean]
			  -c, --config                    Path to .toml configuration file  [string]
			  -e, --env                       Environment to use for operations and .env files  [string]
			  -h, --help                      Show help  [boolean]
			  -v, --version                   Show version number  [boolean]"
		`);
			});

			describe("add", () => {
				function mockPostRequest(
					expectedQueueName: string,
					expectedBody: PostConsumerBody
				) {
					const requests = { count: 0 };
					msw.use(
						rest.post(
							"*/accounts/:accountId/workers/queues/:queueName/consumers",
							async (request, response, context) => {
								requests.count += 1;
								expect(request.params.queueName).toEqual(expectedQueueName);
								expect(request.params.accountId).toEqual("some-account-id");
								expect(await request.json()).toEqual(expectedBody);
								return response.once(
									context.json({
										success: true,
										errors: [],
										messages: [],
										result: {},
									})
								);
							}
						)
					);
					return requests;
				}

				it("should show the correct help text", async () => {
					await runWrangler("queues consumer add --help");
					expect(std.err).toMatchInlineSnapshot(`""`);
					expect(std.out).toMatchInlineSnapshot(`
				"wrangler queues consumer add <queue-name> <script-name>

				Add a Queue Worker Consumer

				Positionals:
				  queue-name   Name of the queue to configure  [string] [required]
				  script-name  Name of the consumer script  [string] [required]

				Flags:
				  -j, --experimental-json-config  Experimental: Support wrangler.json  [boolean]
				  -c, --config                    Path to .toml configuration file  [string]
				  -e, --env                       Environment to use for operations and .env files  [string]
				  -h, --help                      Show help  [boolean]
				  -v, --version                   Show version number  [boolean]

				Options:
				      --batch-size         Maximum number of messages per batch  [number]
				      --batch-timeout      Maximum number of seconds to wait to fill a batch with messages  [number]
				      --message-retries    Maximum number of retries for each message  [number]
				      --dead-letter-queue  Queue to send messages that failed to be consumed  [string]
				      --max-concurrency    The maximum number of concurrent consumer Worker invocations. Must be a positive integer  [number]
				      --retry-delay        How long a retried messages should be delayed for, in seconds. Must be a positive integer  [number]"
			`);
				});

				it("should add a consumer using defaults", async () => {
					const expectedBody: PostConsumerBody = {
						script_name: "testScript",
						environment_name: "",
						settings: {
							batch_size: undefined,
							max_retries: undefined,
							max_wait_time_ms: undefined,
							max_concurrency: undefined,
							retry_delay: undefined,
						},
						dead_letter_queue: undefined,
					};
					mockPostRequest("testQueue", expectedBody);
					await runWrangler("queues consumer add testQueue testScript");
					expect(std.out).toMatchInlineSnapshot(`
							"Adding consumer to queue testQueue.
							Added consumer to queue testQueue."
					`);
				});

				it("should add a consumer using custom values", async () => {
					const expectedBody: PostConsumerBody = {
						script_name: "testScript",
						environment_name: "myEnv",
						settings: {
							batch_size: 20,
							max_retries: 3,
							max_wait_time_ms: 10 * 1000,
							max_concurrency: 3,
							retry_delay: 10,
						},
						dead_letter_queue: "myDLQ",
					};
					mockPostRequest("testQueue", expectedBody);

					await runWrangler(
						"queues consumer add testQueue testScript --env myEnv --batch-size 20 --batch-timeout 10 --message-retries 3 --max-concurrency 3 --dead-letter-queue myDLQ --retry-delay=10"
					);
					expect(std.out).toMatchInlineSnapshot(`
						"Adding consumer to queue testQueue.
						Added consumer to queue testQueue."
					`);
				});

				it("should show an error when two retry delays are set", async () => {
					const expectedBody: PostConsumerBody = {
						script_name: "testScript",
						environment_name: "myEnv",
						settings: {
							batch_size: 20,
							max_retries: 3,
							max_wait_time_ms: 10 * 1000,
							max_concurrency: 3,
							retry_delay: 0,
						},
						dead_letter_queue: "myDLQ",
					};
					const requests = mockPostRequest("testQueue", expectedBody);

					await expect(
						runWrangler(
							"queues consumer add testQueue testScript --env myEnv --batch-size 20 --batch-timeout 10 --message-retries 3 --max-concurrency 3 --dead-letter-queue myDLQ --retry-delay=5 --retry-delay=10"
						)
					).rejects.toThrowErrorMatchingInlineSnapshot(
						`"Error: can't use more than a delay setting."`
					);

					expect(requests.count).toEqual(0);
				});

				it("should show link to dash when not enabled", async () => {
					const queueName = "testQueue";
					msw.use(
						rest.post(
							"*/accounts/:accountId/workers/queues/:queueName/consumers",
							async (request, response, context) => {
								expect(request.params.queueName).toEqual(queueName);
								expect(request.params.accountId).toEqual("some-account-id");
								return response.once(
									context.status(403),
									context.json({
										success: false,
										errors: [
											{
												code: 10023,
												message: "workers.api.error.unauthorized",
											},
										],
										messages: [],
										result: {},
									})
								);
							}
						)
					);

					await expect(
						runWrangler(`queues consumer add ${queueName} testScript`)
					).rejects.toThrowError();
					expect(std.out).toMatchInlineSnapshot(`
				"Adding consumer to queue testQueue.
				Queues is not currently enabled on this account. Go to https://dash.cloudflare.com/some-account-id/workers/queues to enable it.

				[31mX [41;31m[[41;97mERROR[41;31m][0m [1mA request to the Cloudflare API (/accounts/some-account-id/workers/queues/testQueue/consumers) failed.[0m

				  workers.api.error.unauthorized [code: 10023]

				  If you think this is a bug, please open an issue at:
				  [4mhttps://github.com/cloudflare/workers-sdk/issues/new/choose[0m

				"
			`);
				});
			});

			describe("delete", () => {
				function mockDeleteRequest(
					expectedQueueName: string,
					expectedScriptName: string,
					expectedEnvName?: string
				) {
					const requests = { count: 0 };
					let resource = `accounts/:accountId/workers/queues/:expectedQueueName/consumers/:expectedScriptName`;
					if (expectedEnvName !== undefined) {
						resource += `/environments/:expectedEnvName`;
					}
					msw.use(
						rest.delete(`*/${resource}`, async (request, response, context) => {
							requests.count++;
							expect(request.params.accountId).toBe("some-account-id");
							expect(request.params.expectedQueueName).toBe(expectedQueueName);
							expect(request.params.expectedScriptName).toBe(
								expectedScriptName
							);
							return response.once(
								context.status(200),
								context.json({
									success: true,
									errors: [],
									messages: [],
									result: {},
								})
							);
						})
					);

					return requests;
				}

				it("should show the correct help text", async () => {
					await runWrangler("queues consumer remove --help");
					expect(std.err).toMatchInlineSnapshot(`""`);
					expect(std.out).toMatchInlineSnapshot(`
				"wrangler queues consumer remove <queue-name> <script-name>

				Remove a Queue Worker Consumer

				Positionals:
				  queue-name   Name of the queue to configure  [string] [required]
				  script-name  Name of the consumer script  [string] [required]

				Flags:
				  -j, --experimental-json-config  Experimental: Support wrangler.json  [boolean]
				  -c, --config                    Path to .toml configuration file  [string]
				  -e, --env                       Environment to use for operations and .env files  [string]
				  -h, --help                      Show help  [boolean]
				  -v, --version                   Show version number  [boolean]"
			`);
				});

				it("should delete a consumer with no --env", async () => {
					const requests = mockDeleteRequest("testQueue", "testScript");
					await runWrangler("queues consumer remove testQueue testScript");

					expect(requests.count).toEqual(1);
					expect(std.out).toMatchInlineSnapshot(`
						"Removing consumer from queue testQueue.
						Removed consumer from queue testQueue."
					`);
				});

				it("should delete a consumer with --env", async () => {
					const requests = mockDeleteRequest(
						"testQueue",
						"testScript",
						"myEnv"
					);
					await runWrangler(
						"queues consumer remove testQueue testScript --env myEnv"
					);

					expect(requests.count).toEqual(1);
					expect(std.out).toMatchInlineSnapshot(`
						"Removing consumer from queue testQueue.
						Removed consumer from queue testQueue."
					`);
				});
			});
		});

		describe("http_pull consumers", () => {
			it("should show the correct help text", async () => {
				await runWrangler("queues consumer http --help");

				expect(std.err).toMatchInlineSnapshot(`""`);
				expect(std.out).toMatchInlineSnapshot(`
			"wrangler queues consumer http

			Configure Queue HTTP Pull Consumers

			Commands:
			  wrangler queues consumer http add <queue-name>     Add a Queue HTTP Pull Consumer
			  wrangler queues consumer http remove <queue-name>  Remove a Queue HTTP Pull Consumer

			Flags:
			  -j, --experimental-json-config  Experimental: Support wrangler.json  [boolean]
			  -c, --config                    Path to .toml configuration file  [string]
			  -e, --env                       Environment to use for operations and .env files  [string]
			  -h, --help                      Show help  [boolean]
			  -v, --version                   Show version number  [boolean]"
		`);
			});

			describe("add", () => {
				function mockGetQueueRequest(expectedQueueName: string) {
					const requests = { count: 0 };
					msw.use(
						rest.get(
							"*/accounts/:accountId/workers/queues/:queueName",
							async (request, response, context) => {
								requests.count += 1;
								expect(request.params.queueName).toEqual(expectedQueueName);
								expect(request.params.accountId).toEqual("some-account-id");
								return response.once(
									context.json({
										success: true,
										errors: [],
										messages: [],
										result: {
											queue_id: "fake-queue-id",
										},
									})
								);
							}
						)
					);
					return requests;
				}
				function mockPostRequest(
					expectedQueueId: string,
					expectedBody: PostTypedConsumerBody
				) {
					const requests = { count: 0 };
					msw.use(
						rest.post(
							"*/accounts/:accountId/queues/:queueId/consumers",
							async (request, response, context) => {
								requests.count += 1;
								expect(request.params.queueId).toEqual(expectedQueueId);
								expect(request.params.accountId).toEqual("some-account-id");
								expect(await request.json()).toEqual(expectedBody);
								return response.once(
									context.json({
										success: true,
										errors: [],
										messages: [],
										result: {},
									})
								);
							}
						)
					);
					return requests;
				}

				it("should show the correct help text", async () => {
					await runWrangler("queues consumer http add --help");
					expect(std.err).toMatchInlineSnapshot(`""`);
					expect(std.out).toMatchInlineSnapshot(`
				"wrangler queues consumer http add <queue-name>

				Add a Queue HTTP Pull Consumer

				Positionals:
				  queue-name  Name of the queue for the consumer  [string] [required]

				Flags:
				  -j, --experimental-json-config  Experimental: Support wrangler.json  [boolean]
				  -c, --config                    Path to .toml configuration file  [string]
				  -e, --env                       Environment to use for operations and .env files  [string]
				  -h, --help                      Show help  [boolean]
				  -v, --version                   Show version number  [boolean]

				Options:
				      --batch-size               Maximum number of messages per batch  [number]
				      --message-retries          Maximum number of retries for each message  [number]
				      --dead-letter-queue        Queue to send messages that failed to be consumed  [string]
				      --visibility-timeout-secs  The number of seconds a message will wait for an acknowledgement before being returned to the queue.  [number]
				      --retry-delay-secs         The number of seconds to wait before retrying a message  [number]"
			`);
				});

				it("should add a consumer using defaults", async () => {
					const expectedBody: PostTypedConsumerBody = {
						type: "http_pull",
						settings: {
							batch_size: undefined,
							max_retries: undefined,
							visibility_timeout_ms: undefined,
							retry_delay: undefined,
						},
						dead_letter_queue: undefined,
					};
					mockPostRequest("fake-queue-id", expectedBody);
					mockGetQueueRequest("testQueue");

					await runWrangler("queues consumer http add testQueue");
					expect(std.out).toMatchInlineSnapshot(`
							"Adding consumer to queue testQueue.
							Added consumer to queue testQueue."
					`);
				});

				it("should add a consumer using custom values", async () => {
					const expectedBody: PostTypedConsumerBody = {
						type: "http_pull",
						settings: {
							batch_size: 20,
							max_retries: 3,
							visibility_timeout_ms: 6000,
							retry_delay: 3,
						},
						dead_letter_queue: "myDLQ",
					};
					mockPostRequest("fake-queue-id", expectedBody);
					mockGetQueueRequest("testQueue");

					await runWrangler(
						"queues consumer http add testQueue --batch-size 20 --message-retries 3 --visibility-timeout-secs 6 --retry-delay-secs 3 --dead-letter-queue myDLQ"
					);
					expect(std.out).toMatchInlineSnapshot(`
						"Adding consumer to queue testQueue.
						Added consumer to queue testQueue."
					`);
				});
			});

			describe("delete", () => {
				function mockGetQueueRequest(expectedQueueName: string) {
					const requests = { count: 0 };
					msw.use(
						rest.get(
							"*/accounts/:accountId/workers/queues/:queueName",
							async (request, response, context) => {
								requests.count += 1;
								expect(request.params.queueName).toEqual(expectedQueueName);
								expect(request.params.accountId).toEqual("some-account-id");
								return response.once(
									context.json({
										success: true,
										errors: [],
										messages: [],
										result: {
											queue_id: "fake-queue-id",
											consumers: [
												{ consumer_id: "fake-consumer-id", type: "http_pull" },
											],
										},
									})
								);
							}
						)
					);
					return requests;
				}
				function mockDeleteRequest(
					expectedQueueId: string,
					expectedConsumerId: string
				) {
					const requests = { count: 0 };
					const resource = `accounts/:accountId/queues/:expectedQueueId/consumers/:expectedConsumerId`;
					msw.use(
						rest.delete(`*/${resource}`, async (request, response, context) => {
							requests.count++;
							expect(request.params.accountId).toBe("some-account-id");
							expect(request.params.expectedQueueId).toBe(expectedQueueId);
							expect(request.params.expectedConsumerId).toBe(
								expectedConsumerId
							);
							return response.once(
								context.status(200),
								context.json({
									success: true,
									errors: [],
									messages: [],
									result: {},
								})
							);
						})
					);

					return requests;
				}

				it("should show the correct help text", async () => {
					await runWrangler("queues consumer http remove --help");
					expect(std.err).toMatchInlineSnapshot(`""`);
					expect(std.out).toMatchInlineSnapshot(`
				"wrangler queues consumer http remove <queue-name>

				Remove a Queue HTTP Pull Consumer

				Positionals:
				  queue-name  Name of the queue for the consumer  [string] [required]

				Flags:
				  -j, --experimental-json-config  Experimental: Support wrangler.json  [boolean]
				  -c, --config                    Path to .toml configuration file  [string]
				  -e, --env                       Environment to use for operations and .env files  [string]
				  -h, --help                      Show help  [boolean]
				  -v, --version                   Show version number  [boolean]"
			`);
				});

				it("should delete a pull consumer", async () => {
					mockGetQueueRequest("testQueue");
					const requests = mockDeleteRequest(
						"fake-queue-id",
						"fake-consumer-id"
					);
					await runWrangler("queues consumer http remove testQueue");

					expect(requests.count).toEqual(1);
					expect(std.out).toMatchInlineSnapshot(`
							"Removing consumer from queue testQueue.
							Removed consumer from queue testQueue."
						`);
				});
			});
		});
	});
});
