import { readConfig } from "../../../config";
import { CommandLineArgsError } from "../../../index";
import { logger } from "../../../logger";
import { createQueue } from "../../client";
import { handleFetchError } from "../../utils";
import type {
	CommonYargsArgv,
	StrictYargsOptionsToInterface,
} from "../../../yargs-types";
import type { CreateQueueBody } from "../../client";

export function options(yargs: CommonYargsArgv) {
	return yargs
		.positional("name", {
			type: "string",
			demandOption: true,
			description: "The name of the queue",
		})
		.options({
			"delivery-delay": {
				type: "number",
				describe:
					"How long a published message should be delayed for, in seconds. Must be a positive integer",
			},
		});
}

function createBody(
	args: StrictYargsOptionsToInterface<typeof options>
): CreateQueueBody {
	const body: CreateQueueBody = {
		queue_name: args.name,
	};

	if (Array.isArray(args.deliveryDelay)) {
		throw new CommandLineArgsError(
			"Cannot specify --delivery-delay multiple times"
		);
	}

	if (args.deliveryDelay != undefined) {
		body.settings = {
			delivery_delay: args.deliveryDelay,
		};
	}

	return body;
}

export async function handler(
	args: StrictYargsOptionsToInterface<typeof options>
) {
	const config = readConfig(args.config, args);
	const body = createBody(args);
	try {
		logger.log(`Creating queue ${args.name}.`);
		await createQueue(config, body);
		logger.log(`Created queue ${args.name}.`);
	} catch (e) {
		handleFetchError(e as { code?: number });
	}
}
