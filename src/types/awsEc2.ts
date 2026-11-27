import type {
  InfraComputeSelection,
  InfraExecutionContext,
  InfraResult,
} from '@ankhorage/contracts/infra';

export interface AwsEc2Instance {
  readonly id: string;
  readonly state:
    'pending' | 'running' | 'stopped' | 'stopping' | 'shutting-down' | 'terminated' | 'failed';
  readonly publicIp?: string;
  readonly privateIp?: string;
  readonly configurationHash?: string;
}

export interface AwsEc2Api {
  validateAsync(
    selection: InfraComputeSelection<'aws-ec2'>,
    signal?: AbortSignal,
  ): Promise<InfraResult<null>>;
  inspectAsync(
    identity: AwsEc2Identity,
    signal?: AbortSignal,
  ): Promise<InfraResult<readonly AwsEc2Instance[]>>;
  createAsync(input: AwsEc2CreateInput, signal?: AbortSignal): Promise<InfraResult<AwsEc2Instance>>;
  startAsync(instanceId: string, signal?: AbortSignal): Promise<InfraResult<null>>;
  terminateAsync(instanceId: string, signal?: AbortSignal): Promise<InfraResult<null>>;
}

export interface AwsEc2Identity {
  readonly projectId: string;
  readonly environment: InfraExecutionContext['environment'];
}
export interface AwsEc2CreateInput {
  readonly identity: AwsEc2Identity;
  readonly selection: InfraComputeSelection<'aws-ec2'>;
  readonly configurationHash: string;
}
export interface AwsEc2AdapterOptions {
  readonly api?: AwsEc2Api;
}
