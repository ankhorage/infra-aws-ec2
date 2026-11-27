import { createInfraAdapter, infraAdapterDescriptor } from '@ankhorage/infra-aws-ec2';

/*** Compose the reusable AWS EC2 adapter with an SSH-capable runtime selection. @usage @readme @title AWS EC2 compute */
const adapter = createInfraAdapter();

console.log(infraAdapterDescriptor.id, adapter.descriptor.package);
