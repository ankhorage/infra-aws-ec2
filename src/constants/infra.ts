import { INFRA_ADAPTER_CATALOG, type InfraAdapterDescriptor } from '@ankhorage/contracts/infra';

/*** Canonical Contracts-backed adapter discovery descriptor. */
export const infraAdapterDescriptor = INFRA_ADAPTER_CATALOG[
  'aws-ec2'
] satisfies InfraAdapterDescriptor<'aws-ec2'>;
