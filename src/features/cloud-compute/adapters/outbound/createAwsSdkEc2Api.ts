import type { InfraComputeSelection, InfraResult } from '@ankhorage/contracts/infra';
import {
  type _InstanceType,
  DescribeImagesCommand,
  DescribeInstancesCommand,
  DescribeInstanceStatusCommand,
  DescribeInstanceTypesCommand,
  DescribeSecurityGroupsCommand,
  DescribeSubnetsCommand,
  EC2Client,
  RunInstancesCommand,
  type RunInstancesCommandInput,
  StartInstancesCommand,
  TerminateInstancesCommand,
} from '@aws-sdk/client-ec2';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';

import type {
  AwsEc2Api,
  AwsEc2CreateInput,
  AwsEc2ExecutionContext,
  AwsEc2Identity,
  AwsEc2Instance,
} from '../../../../types/awsEc2.js';

/*** Create an AWS boundary which accepts only explicit, port-resolved credentials. */
export function createAwsSdkEc2Api(): AwsEc2Api {
  return new AwsSdkEc2Api();
}

class AwsSdkEc2Api implements AwsEc2Api {
  async validateAsync(
    execution: AwsEc2ExecutionContext,
    selection: InfraComputeSelection<'aws-ec2'>,
    signal?: AbortSignal,
  ): Promise<InfraResult<null>> {
    try {
      const caller = await sts(execution).send(new GetCallerIdentityCommand({}), {
        abortSignal: signal,
      });
      if (caller.Account !== execution.accountId) return fail('aws-ec2-account-mismatch');
      const client = ec2(execution);
      await Promise.all([
        client.send(new DescribeImagesCommand({ ImageIds: [selection.ami] }), {
          abortSignal: signal,
        }),
        client.send(
          new DescribeInstanceTypesCommand({
            InstanceTypes: [selection.instanceType as _InstanceType],
          }),
          { abortSignal: signal },
        ),
        client.send(new DescribeSubnetsCommand({ SubnetIds: [selection.subnetId] }), {
          abortSignal: signal,
        }),
        client.send(
          new DescribeSecurityGroupsCommand({ GroupIds: [...selection.securityGroupIds] }),
          { abortSignal: signal },
        ),
      ]);
      return ok(null);
    } catch {
      return fail('aws-ec2-validation-failed');
    }
  }
  async inspectAsync(
    execution: AwsEc2ExecutionContext,
    identity: AwsEc2Identity,
    signal?: AbortSignal,
  ): Promise<InfraResult<readonly AwsEc2Instance[]>> {
    try {
      const result = await ec2(execution).send(
        new DescribeInstancesCommand({
          Filters: Object.entries(tags(identity, execution)).map(([key, value]) => ({
            Name: `tag:${key}`,
            Values: [value],
          })),
        }),
        { abortSignal: signal },
      );
      const values = (result.Reservations ?? [])
        .flatMap((reservation) => reservation.Instances ?? [])
        .map(toInstance)
        .filter((value) => value.id.length > 0);
      return values.length > 1 ? fail('aws-ec2-ownership-collision') : ok(values);
    } catch {
      return fail('aws-ec2-inspection-failed');
    }
  }
  async createAsync(
    input: AwsEc2CreateInput,
    signal?: AbortSignal,
  ): Promise<InfraResult<AwsEc2Instance>> {
    try {
      const result = await ec2(input.execution).send(new RunInstancesCommand(request(input)), {
        abortSignal: signal,
      });
      const created = result.Instances?.[0];
      return created?.InstanceId === undefined
        ? fail('aws-ec2-create-failed')
        : ok({ id: created.InstanceId, state: 'pending' });
    } catch {
      return fail('aws-ec2-create-failed');
    }
  }
  async startAsync(
    execution: AwsEc2ExecutionContext,
    instanceId: string,
    signal?: AbortSignal,
  ): Promise<InfraResult<null>> {
    try {
      await ec2(execution).send(new StartInstancesCommand({ InstanceIds: [instanceId] }), {
        abortSignal: signal,
      });
      return ok(null);
    } catch {
      return fail('aws-ec2-start-failed');
    }
  }
  async terminateAsync(
    execution: AwsEc2ExecutionContext,
    instanceId: string,
    signal?: AbortSignal,
  ): Promise<InfraResult<null>> {
    try {
      await ec2(execution).send(new TerminateInstancesCommand({ InstanceIds: [instanceId] }), {
        abortSignal: signal,
      });
      return ok(null);
    } catch {
      return fail('aws-ec2-destroy-failed');
    }
  }
  async waitUntilReadyAsync(
    execution: AwsEc2ExecutionContext,
    instanceId: string,
    signal?: AbortSignal,
  ): Promise<InfraResult<AwsEc2Instance>> {
    const deadline = Date.now() + 120_000;
    try {
      while (Date.now() < deadline) {
        if (signal?.aborted) return fail('aws-ec2-readiness-cancelled');
        const [status, details] = await Promise.all([
          ec2(execution).send(
            new DescribeInstanceStatusCommand({
              InstanceIds: [instanceId],
              IncludeAllInstances: true,
            }),
            { abortSignal: signal },
          ),
          ec2(execution).send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }), {
            abortSignal: signal,
          }),
        ]);
        const raw = details.Reservations?.flatMap((reservation) => reservation.Instances ?? [])[0];
        const value = raw === undefined ? undefined : toInstance(raw);
        const checks = status.InstanceStatuses?.[0];
        if (isReady(value, checks?.InstanceStatus?.Status, checks?.SystemStatus?.Status))
          return ok(value);
        await waitAsync(2_000, signal);
      }
      return fail('aws-ec2-readiness-timeout');
    } catch {
      return fail(signal?.aborted ? 'aws-ec2-readiness-cancelled' : 'aws-ec2-readiness-failed');
    }
  }
}

/*** Produce a secure idempotent EC2 creation request. */
function request(input: AwsEc2CreateInput): RunInstancesCommandInput {
  const ownership = tags(input.identity, input.execution);
  return {
    ImageId: input.selection.ami,
    InstanceType: input.selection.instanceType as _InstanceType,
    MinCount: 1,
    MaxCount: 1,
    ClientToken:
      `${input.identity.projectId}-${input.identity.environment}-${input.execution.accountId}-${input.execution.region}-${input.configurationHash}`.slice(
        0,
        64,
      ),
    SubnetId: input.selection.subnetId,
    SecurityGroupIds: [...input.selection.securityGroupIds],
    KeyName: input.selection.ssh.keyName,
    IamInstanceProfile:
      input.selection.iamInstanceProfile === undefined
        ? undefined
        : { Name: input.selection.iamInstanceProfile },
    MetadataOptions: { HttpTokens: 'required' },
    BlockDeviceMappings: [
      {
        DeviceName: '/dev/sda1',
        Ebs: {
          Encrypted: true,
          VolumeSize: input.selection.rootVolume?.sizeGiB,
          VolumeType: input.selection.rootVolume?.type,
          DeleteOnTermination: input.selection.rootVolume?.deleteOnTermination ?? true,
        },
      },
    ],
    TagSpecifications: [
      {
        ResourceType: 'instance',
        Tags: Object.entries({
          ...input.selection.tags,
          ...ownership,
          'ankhorage:configuration-hash': input.configurationHash,
        }).map(([Key, Value]) => ({ Key, Value })),
      },
    ],
  };
}
function ec2(execution: AwsEc2ExecutionContext): EC2Client {
  return new EC2Client({ region: execution.region, credentials: credentials(execution) });
}
function sts(execution: AwsEc2ExecutionContext): STSClient {
  return new STSClient({ region: execution.region, credentials: credentials(execution) });
}
function credentials(execution: AwsEc2ExecutionContext) {
  return {
    accessKeyId: execution.accessKeyId,
    secretAccessKey: execution.secretAccessKey,
    sessionToken: execution.sessionToken,
  };
}
function tags(identity: AwsEc2Identity, execution: AwsEc2ExecutionContext): Record<string, string> {
  return {
    'ankhorage:project-id': identity.projectId,
    'ankhorage:environment': identity.environment,
    'ankhorage:account-id': execution.accountId,
    'ankhorage:region': execution.region,
    'ankhorage:adapter': 'aws-ec2',
  };
}
function toInstance(value: {
  InstanceId?: string;
  State?: { Name?: string };
  PublicIpAddress?: string;
  PrivateIpAddress?: string;
  Tags?: readonly { Key?: string; Value?: string }[];
}): AwsEc2Instance {
  return {
    id: value.InstanceId ?? '',
    state: state(value.State?.Name),
    publicIp: value.PublicIpAddress,
    privateIp: value.PrivateIpAddress,
    configurationHash: value.Tags?.find((tag) => tag.Key === 'ankhorage:configuration-hash')?.Value,
  };
}
function state(value: string | undefined): AwsEc2Instance['state'] {
  return value === 'running' ||
    value === 'stopped' ||
    value === 'stopping' ||
    value === 'shutting-down' ||
    value === 'terminated' ||
    value === 'pending'
    ? value
    : 'failed';
}
function isReady(
  value: AwsEc2Instance | undefined,
  instanceStatus: string | undefined,
  systemStatus: string | undefined,
): value is AwsEc2Instance & { publicIp: string } {
  return (
    value?.state === 'running' &&
    value.publicIp !== undefined &&
    instanceStatus === 'ok' &&
    systemStatus === 'ok'
  );
}
function waitAsync(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout);
        reject(new Error('aborted'));
      },
      { once: true },
    );
  });
}
function ok<T>(value: T): InfraResult<T> {
  return { ok: true, value, diagnostics: [] };
}
function fail(code: string): InfraResult<never> {
  return {
    ok: false,
    diagnostics: [{ severity: 'error', code, message: 'AWS EC2 API operation failed.' }],
  };
}
