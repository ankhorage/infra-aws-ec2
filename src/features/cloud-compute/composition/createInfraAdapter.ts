import type { InfraComputeAdapter } from '@ankhorage/contracts/infra';

import { infraAdapterDescriptor } from '../../../constants/infra.js';
import type { AwsEc2AdapterOptions } from '../../../types/awsEc2.js';
import { createAwsSdkEc2Api } from '../adapters/outbound/createAwsSdkEc2Api.js';
import {
  destroyAwsEc2ComputeAsync,
  ensureAwsEc2ComputeAsync,
  inspectAwsEc2ComputeAsync,
  planAwsEc2ComputeAsync,
  statusAwsEc2ComputeAsync,
  validateAwsEc2ComputeAsync,
} from '../application/awsEc2Compute.js';

/*** Create the canonical AWS EC2 compute adapter with an injectable provider boundary. @readme */
export function createInfraAdapter(
  options: AwsEc2AdapterOptions = {},
): InfraComputeAdapter<'aws-ec2'> {
  const api = options.api ?? createAwsSdkEc2Api();
  return {
    descriptor: infraAdapterDescriptor,
    validateAsync: (context) => validateAwsEc2ComputeAsync(api, context),
    inspectAsync: (context) => inspectAwsEc2ComputeAsync(api, context),
    planAsync: (context) => planAwsEc2ComputeAsync(api, context),
    ensureAsync: (context) => ensureAwsEc2ComputeAsync(api, context),
    statusAsync: (context) => statusAwsEc2ComputeAsync(api, context),
    destroyAsync: (context, request) => destroyAwsEc2ComputeAsync(api, context, request),
  };
}
