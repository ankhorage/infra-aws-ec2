# Public API

## AwsEc2AdapterOptions

Kind: `type`
Module: `src/types/awsEc2.ts`
Source: `src/types/awsEc2.ts:64:1`

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| api | property | `AwsEc2Api \| undefined` | no |  |

## AwsEc2Api

Kind: `type`
Module: `src/types/awsEc2.ts`
Source: `src/types/awsEc2.ts:25:1`

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| createAsync | method | `(input: AwsEc2CreateInput, signal?: AbortSignal) => Promise<InfraResult<AwsEc2Instance>>` | yes |  |
| inspectAsync | method | `(execution: AwsEc2ExecutionContext, identity: AwsEc2Identity, signal?: AbortSignal) => Promise<InfraResult<readonly AwsEc2Instance[]>>` | yes |  |
| startAsync | method | `(execution: AwsEc2ExecutionContext, instanceId: string, signal?: AbortSignal) => Promise<InfraResult<null>>` | yes |  |
| terminateAsync | method | `(execution: AwsEc2ExecutionContext, instanceId: string, signal?: AbortSignal) => Promise<InfraResult<null>>` | yes |  |
| validateAsync | method | `(execution: AwsEc2ExecutionContext, selection: InfraComputeSelection<"aws-ec2">, signal?: AbortSignal) => Promise<InfraResult<null>>` | yes |  |
| waitUntilReadyAsync | method | `(execution: AwsEc2ExecutionContext, instanceId: string, signal?: AbortSignal) => Promise<InfraResult<AwsEc2Instance>>` | yes |  |

## AwsEc2CreateInput

Kind: `type`
Module: `src/types/awsEc2.ts`
Source: `src/types/awsEc2.ts:58:1`

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| configurationHash | property | `string` | yes |  |
| execution | property | `AwsEc2ExecutionContext` | yes |  |
| identity | property | `AwsEc2Identity` | yes |  |
| selection | property | `{ readonly provider: "aws-ec2"; } & { readonly region: string; readonly instanceType: string; readonly ami: string; readonly architecture: "x86_64" \| "arm64"; readonly vpcId: string; readonly subnetId: string; readonly securityGroupIds: readonly string[]; readonly credentials?: import("@ankhorage/contracts/infra").InfraControlPlaneCredentialRef; readonly iamInstanceProfile?: string; readonly ssh: { readonly keyName: string; readonly credentials: import("@ankhorage/contracts/infra").InfraControlPlaneCredentialRef; readonly hostKeyFingerprint: string; readonly authorizedCidrs: readonly string[]; readonly user?: string; readonly port?: number; }; readonly rootVolume?: { readonly sizeGiB?: number; readonly type?: "gp3" \| "gp2" \| "io1" \| "io2"; readonly iops?: number; readonly throughputMiBps?: number; readonly deleteOnTermination?: boolean; }; readonly tags?: Readonly<Record<string, string>>; }` | yes |  |

## AwsEc2Identity

Kind: `type`
Module: `src/types/awsEc2.ts`
Source: `src/types/awsEc2.ts:54:1`

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| environment | property | `"local" \| "preview" \| "production"` | yes |  |
| projectId | property | `string` | yes |  |

## AwsEc2Instance

Kind: `type`
Module: `src/types/awsEc2.ts`
Source: `src/types/awsEc2.ts:7:1`

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| configurationHash | property | `string \| undefined` | no |  |
| id | property | `string` | yes |  |
| privateIp | property | `string \| undefined` | no |  |
| publicIp | property | `string \| undefined` | no |  |
| state | property | `"pending" \| "running" \| "stopped" \| "stopping" \| "shutting-down" \| "terminated" \| "failed"` | yes |  |

## createAwsSdkEc2Api

Kind: `function`
Module: `src/features/cloud-compute/adapters/outbound/createAwsSdkEc2Api.ts`
Source: `src/features/cloud-compute/adapters/outbound/createAwsSdkEc2Api.ts:27:1`

Create an AWS boundary which accepts only explicit, port-resolved credentials.

### Signatures

- `() => AwsEc2Api`
  - returns: `AwsEc2Api`

## createInfraAdapter

Kind: `function`
Module: `src/features/cloud-compute/composition/createInfraAdapter.ts`
Source: `src/features/cloud-compute/composition/createInfraAdapter.ts:16:1`

Create the canonical AWS EC2 compute adapter with an injectable provider boundary. @readme

### Signatures

- `(options?: AwsEc2AdapterOptions) => InfraComputeAdapter<"aws-ec2">`
  - options: `AwsEc2AdapterOptions` (optional)
  - returns: `InfraComputeAdapter<"aws-ec2">`

## infraAdapterDescriptor

Kind: `value`
Module: `src/constants/infra.ts`
Source: `src/constants/infra.ts:4:14`

Canonical Contracts-backed adapter discovery descriptor.
