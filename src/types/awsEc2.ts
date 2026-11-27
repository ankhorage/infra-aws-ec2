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

/** Credentials and account binding resolved once from the trusted Infra credential port. */
export interface AwsEc2ExecutionContext {
  readonly region: string;
  readonly accountId: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly sessionToken?: string;
}

export interface AwsEc2Api {
  validateAsync(
    execution: AwsEc2ExecutionContext,
    selection: InfraComputeSelection<'aws-ec2'>,
    signal?: AbortSignal,
  ): Promise<InfraResult<null>>;
  inspectAsync(
    execution: AwsEc2ExecutionContext,
    identity: AwsEc2Identity,
    signal?: AbortSignal,
  ): Promise<InfraResult<readonly AwsEc2Instance[]>>;
  createAsync(input: AwsEc2CreateInput, signal?: AbortSignal): Promise<InfraResult<AwsEc2Instance>>;
  startAsync(
    execution: AwsEc2ExecutionContext,
    instanceId: string,
    signal?: AbortSignal,
  ): Promise<InfraResult<null>>;
  terminateAsync(
    execution: AwsEc2ExecutionContext,
    instanceId: string,
    signal?: AbortSignal,
  ): Promise<InfraResult<null>>;
  waitUntilReadyAsync(
    execution: AwsEc2ExecutionContext,
    instanceId: string,
    signal?: AbortSignal,
  ): Promise<InfraResult<AwsEc2Instance>>;
}

export interface AwsEc2Identity {
  readonly projectId: string;
  readonly environment: InfraExecutionContext['environment'];
}
export interface AwsEc2CreateInput {
  readonly execution: AwsEc2ExecutionContext;
  readonly identity: AwsEc2Identity;
  readonly selection: InfraComputeSelection<'aws-ec2'>;
  readonly configurationHash: string;
}
export interface AwsEc2AdapterOptions {
  readonly api?: AwsEc2Api;
}
