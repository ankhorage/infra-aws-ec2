/** Public AWS EC2 compute adapter package boundary. */
export { infraAdapterDescriptor } from './constants/infra.js';
export { createAwsSdkEc2Api } from './features/cloud-compute/adapters/outbound/createAwsSdkEc2Api.js';
export { createInfraAdapter } from './features/cloud-compute/composition/createInfraAdapter.js';
export type {
  AwsEc2AdapterOptions,
  AwsEc2Api,
  AwsEc2CreateInput,
  AwsEc2Identity,
  AwsEc2Instance,
} from './types/awsEc2.js';
